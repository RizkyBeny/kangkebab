import { prisma } from '@/lib/prisma';
import { ConsolidatedFinancials, Branch, SalesTransaction, BranchInventory } from '@/types';
import { isForwardTransaction, forwardSettlementSign } from '@/constants';

/** Modal for one transaction, summed from its item rows.
 *
 *  Deliberately NOT `SalesTransaction.totalCost`: `updateSalesTransaction` recalculates
 *  `totalAmount` when a transaction's items are edited but never touches `totalCost`, so that
 *  column drifts from the items it summarises (e.g. INV/CBG-MDN/20260904/0002 is overstated by
 *  Rp 15.500). Reading the items keeps margin in step with the settlement report, which sums the
 *  same way. */
const modalOf = (tx: SalesTransaction) =>
  tx.items.reduce((sum, item) => sum + item.costPrice * item.qty, 0);

/** A running omzet/modal total plus the part of it that HQ supplied on the branch's behalf. */
type Net = {
  /** Gross: every matching transaction at full value. */
  revenue: number;
  modal: number;
  /** The Forward-from-HQ slice of the above, kept apart so it can be deducted. */
  fromHqRevenue: number;
  fromHqModal: number;
};

const emptyNet = (): Net => ({ revenue: 0, modal: 0, fromHqRevenue: 0, fromHqModal: 0 });

/** Accumulates gross figures, separately tracking the HQ-supplied forward slice.
 *
 *  The branch's own figure is then `gross - fromHq`, which is what the "Hari Perhitungan"
 *  settlement does. Accumulators that instead multiply each transaction by a -1 sign get this
 *  wrong by 2x, because the sale is already inside the gross total: netting is a deduction, so a
 *  Forward-from-HQ sale leaves the branch with NOTHING for that transaction, not a negative
 *  contribution on top of a gross that already counted it. */
function accumulateNet(acc: Net, txs: SalesTransaction[], keep?: (t: SalesTransaction) => boolean) {
  for (const tx of txs) {
    if (keep && !keep(tx)) continue;
    const modal = modalOf(tx);
    acc.revenue += tx.totalAmount;
    acc.modal += modal;
    if (tx.forwardSource === 'HQ') {
      acc.fromHqRevenue += tx.totalAmount;
      acc.fromHqModal += modal;
    }
  }
}

const netRevenue = (n: Net) => n.revenue - n.fromHqRevenue;
const netModal = (n: Net) => n.modal - n.fromHqModal;

export async function getConsolidatedFinancials(filters?: {
  startDate?: string;
  endDate?: string;
  branchId?: string;
}): Promise<ConsolidatedFinancials> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const txWhere: any = {};
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const invWhere: any = {};

  if (filters?.branchId) {
    txWhere.branchId = filters.branchId;
    invWhere.branchId = filters.branchId;
  }

  if (filters?.startDate || filters?.endDate) {
    txWhere.createdAt = {};
    if (filters.startDate) {
      txWhere.createdAt.gte = new Date(filters.startDate);
    }
    if (filters.endDate) {
      const end = new Date(filters.endDate);
      end.setUTCHours(23, 59, 59, 999);
      txWhere.createdAt.lte = end;
    }
  }

  // Fetch all transactions matching filters
  const transactions = (await prisma.salesTransaction.findMany({
    where: txWhere,
    include: {
      branch: true,
      items: {
        include: { masterProduct: true },
      },
    },
  })) as unknown as SalesTransaction[];

  // Fetch branch inventories for damaged goods calculation
  const inventories = (await prisma.branchInventory.findMany({
    where: invWhere,
    include: {
      branch: true,
      masterProduct: true,
    },
  })) as unknown as BranchInventory[];

  // Fetch all branches
  const branches = (await prisma.branch.findMany({
    orderBy: { code: 'asc' },
  })) as unknown as Branch[];

  // Everything is accumulated gross, then the HQ-supplied Resi Forward slice is deducted once.
  // Splitting the same transactions into overlapping buckets by platform means the deduction has
  // to be tracked per bucket too, otherwise the channel columns stop adding up to the total.
  const total = emptyNet();
  const online = emptyNet();
  const offline = emptyNet();
  const shopee = emptyNet();
  const tiktok = emptyNet();
  const forward = emptyNet();

  const isOnline = (t: SalesTransaction) => t.channel === 'ONLINE';
  const isOffline = (t: SalesTransaction) => t.channel === 'OFFLINE';
  const isShopee = (t: SalesTransaction) => t.platform === 'SHOPEE';
  const isTiktok = (t: SalesTransaction) => t.platform === 'TIKTOK';
  const isForward = (t: SalesTransaction) => isForwardTransaction(t);

  for (const [acc, keep] of [
    [total, undefined],
    [online, isOnline],
    [offline, isOffline],
    [shopee, isShopee],
    [tiktok, isTiktok],
    [forward, isForward],
  ] as [Net, ((t: SalesTransaction) => boolean) | undefined][]) {
    accumulateNet(acc, transactions, keep);
  }

  const totalRevenue = netRevenue(total);
  const totalCostOfGoods = netModal(total);
  const onlineRevenue = netRevenue(online);
  const offlineRevenue = netRevenue(offline);
  const forwardRevenue = netRevenue(forward);
  const forwardFromHqRevenue = forward.fromHqRevenue;
  const shopeeRevenue = netRevenue(shopee);
  const tiktokRevenue = netRevenue(tiktok);

  const grossMarginAmount = totalRevenue - totalCostOfGoods;
  const grossMarginPercentage = totalRevenue > 0 ? (grossMarginAmount / totalRevenue) * 100 : 0;

  let totalDamagedItemsCount = 0;
  let damagedGoodsValue = 0;

  for (const inv of inventories) {
    totalDamagedItemsCount += inv.qtyDamaged;
    damagedGoodsValue += inv.qtyDamaged * inv.masterProduct.costPrice;
  }

  // Per branch breakdown
  const branchPerformance = branches.map((b: Branch) => {
    const branchTxs = transactions.filter((t: SalesTransaction) => t.branchId === b.id);
    const branchInvs = inventories.filter((i: BranchInventory) => i.branchId === b.id);

    // Same gross-then-deduct treatment as the totals above, so a row's margin always equals
    // `revenue - cost` and its channel columns still add up to its own revenue.
    const bucket = (keep: (t: SalesTransaction) => boolean) => {
      const acc = emptyNet();
      accumulateNet(acc, branchTxs, keep);
      return acc;
    };

    const bTotal = bucket(() => true);
    const bOffline = bucket(isOffline);
    const bShopee = bucket(isShopee);
    const bTiktok = bucket(isTiktok);
    const bForward = bucket(isForward);

    const rev = netRevenue(bTotal);
    const cost = netModal(bTotal);
    const damaged = branchInvs.reduce((sum: number, i: BranchInventory) => sum + i.qtyDamaged, 0);

    return {
      branchId: b.id,
      branchName: b.name,
      branchCode: b.code,
      revenue: rev,
      cost: cost,
      margin: rev - cost,
      transactionCount: branchTxs.length,
      damagedCount: damaged,
      offlineRevenue: netRevenue(bOffline),
      forwardRevenue: netRevenue(bForward),
      forwardFromHqRevenue: bForward.fromHqRevenue,
      shopeeRevenue: netRevenue(bShopee),
      tiktokRevenue: netRevenue(bTiktok),
    };
  });

  // Product Performance Breakdown
  const productMap = new Map<string, {
    masterProductId: string;
    sku: string;
    name: string;
    variant: string;
    qtySold: number;
    forwardQty: number;
    remainingStock: number;
  }>();

  const ensureProduct = (pid: string, seed: { sku: string; name: string; variant: string }) => {
    if (!productMap.has(pid)) {
      productMap.set(pid, { masterProductId: pid, ...seed, qtySold: 0, forwardQty: 0, remainingStock: 0 });
    }
    return productMap.get(pid)!;
  };

  // Aggregate sales. Resi Forward units are counted separately and signed by direction: a
  // Forward sale supplied by HQ never left the branch's own stock, so folding it into qtySold
  // would overstate real sell-through, and counting it positive would hide that the branch
  // supplied nothing.
  for (const tx of transactions) {
    const sign = forwardSettlementSign(tx);
    for (const item of tx.items) {
      const entry = ensureProduct(item.masterProductId, {
        sku: item.masterProduct.sku,
        name: item.masterProduct.name,
        variant: item.masterProduct.variant,
      });
      if (isForwardTransaction(tx)) entry.forwardQty += sign * item.qty;
      else entry.qtySold += item.qty;
    }
  }

  // Aggregate stocks
  for (const inv of inventories) {
    const entry = ensureProduct(inv.masterProductId, {
      sku: inv.masterProduct.sku,
      name: inv.masterProduct.name,
      variant: inv.masterProduct.variant,
    });
    entry.remainingStock += inv.qtyAvailable;
  }

  const productPerformance = Array.from(productMap.values()).sort(
    (a, b) => b.qtySold - a.qtySold || b.forwardQty - a.forwardQty
  );

  return {
    totalRevenue,
    totalCostOfGoods,
    grossMarginAmount,
    grossMarginPercentage,
    totalTransactionsCount: transactions.length,
    totalDamagedItemsCount,
    damagedGoodsValue,
    onlineRevenue,
    offlineRevenue,
    forwardRevenue,
    forwardFromHqRevenue,
    shopeeRevenue,
    tiktokRevenue,
    branchPerformance,
    productPerformance,
  };
}
