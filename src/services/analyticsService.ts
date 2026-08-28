import { prisma } from '@/lib/prisma';
import { ConsolidatedFinancials, Branch, SalesTransaction, BranchInventory } from '@/types';

export async function getConsolidatedFinancials(filters?: {
  startDate?: string;
  endDate?: string;
  branchId?: string;
}): Promise<ConsolidatedFinancials> {
  const txWhere: any = {};
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

  let totalRevenue = 0;
  let totalCostOfGoods = 0;
  let onlineRevenue = 0;
  let offlineRevenue = 0;

  for (const tx of transactions) {
    totalRevenue += tx.totalAmount;
    totalCostOfGoods += tx.totalCost;

    if (tx.channel === 'ONLINE') {
      onlineRevenue += tx.totalAmount;
    } else {
      offlineRevenue += tx.totalAmount;
    }
  }

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

    const rev = branchTxs.reduce((sum: number, t: SalesTransaction) => sum + t.totalAmount, 0);
    const cost = branchTxs.reduce((sum: number, t: SalesTransaction) => sum + t.totalCost, 0);
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
    };
  });

  // Product Performance Breakdown
  const productMap = new Map<string, {
    masterProductId: string;
    sku: string;
    name: string;
    variant: string;
    qtySold: number;
    remainingStock: number;
  }>();

  // Aggregate sales
  for (const tx of transactions) {
    for (const item of tx.items) {
      const pid = item.masterProductId;
      if (!productMap.has(pid)) {
        productMap.set(pid, {
          masterProductId: pid,
          sku: item.masterProduct.sku,
          name: item.masterProduct.name,
          variant: item.masterProduct.variant,
          qtySold: 0,
          remainingStock: 0,
        });
      }
      productMap.get(pid)!.qtySold += item.qty;
    }
  }

  // Aggregate stocks
  for (const inv of inventories) {
    const pid = inv.masterProductId;
    if (!productMap.has(pid)) {
      productMap.set(pid, {
        masterProductId: pid,
        sku: inv.masterProduct.sku,
        name: inv.masterProduct.name,
        variant: inv.masterProduct.variant,
        qtySold: 0,
        remainingStock: 0,
      });
    }
    productMap.get(pid)!.remainingStock += inv.qtyAvailable;
  }

  const productPerformance = Array.from(productMap.values()).sort((a, b) => b.qtySold - a.qtySold);

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
    branchPerformance,
    productPerformance,
  };
}
