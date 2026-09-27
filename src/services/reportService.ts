import { prisma } from '@/lib/prisma';
import { PerhitunganReport, PerhitunganTableRow, SalesTransaction } from '@/types';
import {
  formatPeriodLabel,
  isForwardTransaction,
  parseLocalDate,
} from '@/constants';

type TxWithItems = SalesTransaction & {
  items: {
    qty: number;
    costPrice: number;
    masterProductId: string;
    masterProduct: { name: string; variant: string };
  }[];
};

/** Modal for one item line.
 *
 *  Always read from `item.costPrice` — the price HQ charged when the sale was created — rather
 *  than from `item.masterProduct.costPrice`, because a product's modal can be revised after a
 *  sale and the item must keep its historical cost. */
const modalOf = (item: TxWithItems['items'][number]) => item.costPrice * item.qty;

/** A row while it is still being accumulated. `moved` is bookkeeping for `finalize` and is
 *  stripped before the row reaches the API. */
type AccumRow = PerhitunganTableRow & { moved: boolean };

/** Wraps a raw product key so we can keep a stable display order while accumulating. */
type RowAccumulator = Map<string, AccumRow>;

/** Accumulates one product line, priced at HQ's modal.
 *
 *  `jumlah` is summed from each transaction's OWN modal rather than from the row's displayed
 *  unit price, so the table total stays correct even if HQ revised a product's modal part-way
 *  through the period. When that happens the row is flagged `mixedPrice`, because the printed
 *  unit price can then no longer be multiplied out to reach `jumlah`.
 *
 *  `moved` records that the product was actually sold in this table, separately from the running
 *  signed `qty`. The two differ on the signed Forward table, where a product can ship 2 units
 *  from HQ and 2 from branch stock and net out to a Qty of 0 — dropping that row would make a
 *  table with real Resi Forward activity look empty. */
function accumulate(
  acc: RowAccumulator,
  masterProductId: string,
  name: string,
  variant: string,
  hargaModal: number,
  qtyDelta: number
): void {
  const existing = acc.get(masterProductId);
  if (existing) {
    existing.qty += qtyDelta;
    existing.jumlah += qtyDelta * hargaModal;
    existing.moved = existing.moved || qtyDelta !== 0;
    if (hargaModal !== existing.hargaModal) existing.mixedPrice = true;
    return;
  }
  acc.set(masterProductId, {
    name,
    variant,
    hargaModal,
    qty: qtyDelta,
    jumlah: qtyDelta * hargaModal,
    moved: qtyDelta !== 0,
  });
}

function finalize(acc: RowAccumulator): PerhitunganTableRow[] {
  return Array.from(acc.values())
    .filter((row) => row.moved)
    .sort((a, b) => Math.abs(b.qty) - Math.abs(a.qty) || a.name.localeCompare(b.name, 'id'))
    // Rebuilt field by field so the internal `moved` flag never reaches the client.
    .map((row, index) => ({
      name: `${index + 1}. ${row.name}`,
      variant: row.variant,
      hargaModal: row.hargaModal,
      qty: row.qty,
      jumlah: row.jumlah,
      mixedPrice: row.mixedPrice,
    }));
}

/** One channel's accumulating state: its netted omzet, netted modal and product rows. */
type ChannelBucket = {
  revenue: number;
  modal: number;
  rows: RowAccumulator;
};

const newBucket = (): ChannelBucket => ({ revenue: 0, modal: 0, rows: new Map() });

/**
 * Builds the "Hari Perhitungan" settlement report for a single branch and period.
 *
 * This is a profit-sharing sheet, so it is built around modal and margin rather than
 * around revenue alone: the branch's job is to declare what it sold, HQ assigns the cost
 * via `MasterProduct.costPrice`, and what is left after expenses is what gets shared.
 * That mirrors the printed report, whose `Funds (Modal)` line sits at ~82% of GROSS SALES
 * in both periods.
 *
 * RESI FORWARD IS AN ONLINE SALE, NOT A CHANNEL. `channel` is only ONLINE or OFFLINE, and
 * `forwardSource` marks the online sales HQ shipped on a branch's behalf. Those sales therefore
 * land inside their own platform's omzet and product table — counting them a second time as a
 * separate revenue line would double-count them. What they get instead is a DEDUCTION:
 *
 *   dari Stok Cabang -> the branch supplied and shipped, so it keeps the sale in full
 *   dari HQ          -> the branch supplied nothing, so its omzet AND its modal come back out
 *
 * Netting revenue and modal together is what keeps `omzet - modal = margin` honest. If only
 * omzet were netted, a Forward-from-HQ sale would show negative revenue against positive cost
 * and manufacture a loss the branch never incurred. The channel figures stay gross so their
 * product tables can show plain positive quantities, and the deduction is one visible line
 * between the gross and net totals. `forwardTable` is a signed detail view over those sales,
 * not a fourth revenue line.
 *
 * Modal is summed from the ITEM rows, never from the denormalised
 * `SalesTransaction.totalCost`: `updateSalesTransaction` recalculates `totalAmount` when a
 * transaction's items are edited but leaves `totalCost` untouched, so that column can
 * drift from the items it is supposed to summarise (e.g. INV/CBG-MDN/20260904/0002 is
 * overstated by Rp 15.500). Sourcing from the items also makes the product tables tie to
 * the summary by construction.
 *
 * "Pengeluaran" is not modelled in the database, so it is entered by hand in the UI and
 * passed through at render time.
 */
export async function getPerhitunganReport(filters: {
  branchId: string;
  startDate: string;
  endDate: string;
}): Promise<PerhitunganReport> {
  const branch = await prisma.branch.findUnique({ where: { id: filters.branchId } });
  if (!branch) throw new Error('Cabang tidak ditemukan');

  // Period bounds are built from LOCAL date parts. `new Date('2026-09-01')` would be
  // parsed as 00:00 UTC = 07:00 WIB and silently drop the first 7 hours of the period.
  const start = parseLocalDate(filters.startDate);
  const end = parseLocalDate(filters.endDate);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    throw new Error('Rentang tanggal tidak valid');
  }
  end.setHours(23, 59, 59, 999);
  if (end.getTime() < start.getTime()) {
    throw new Error('Tanggal akhir tidak boleh lebih awal dari tanggal mulai');
  }

  console.log('[DEBUG reportService] Filters:', { branchId: filters.branchId, startDate: filters.startDate, endDate: filters.endDate });
  console.log('[DEBUG reportService] Parsed bounds:', { start: start.toISOString(), end: end.toISOString(), startLocal: start.toString(), endLocal: end.toString() });

  const transactions = (await prisma.salesTransaction.findMany({
    where: { branchId: filters.branchId, createdAt: { gte: start, lte: end } },
    include: {
      branch: true,
      items: { include: { masterProduct: true } },
    },
    orderBy: { createdAt: 'asc' },
  })) as unknown as TxWithItems[];

  console.log('[DEBUG reportService] Found transactions:', transactions.length);
  if (transactions.length > 0) {
    console.log('[DEBUG reportService] First/last createdAt:', transactions[0].createdAt.toISOString(), '→', transactions[transactions.length - 1].createdAt.toISOString());
  }

  const shopee = newBucket();
  const tiktok = newBucket();
  const offline = newBucket();
  const forwardRows: RowAccumulator = new Map();

  let totalInvoiced = 0;
  const forward = {
    fromHq: { revenue: 0, modal: 0, qty: 0 },
    fromBranch: { revenue: 0, modal: 0, qty: 0 },
  };

  for (const tx of transactions) {
    totalInvoiced += tx.totalAmount;

    const isHqSupply = tx.forwardSource === 'HQ';
    const txModal = tx.items.reduce((s, i) => s + modalOf(i), 0);

    // An online sale always carries a platform; TIKTOK is the only one that is not Shopee,
    // and defaulting the rest to Shopee keeps the channel figures summing to the period total
    // rather than silently dropping revenue.
    const bucket = tx.channel === 'OFFLINE' ? offline : tx.platform === 'TIKTOK' ? tiktok : shopee;

    // The channel buckets stay GROSS: they describe what was actually sold, so their product
    // tables can show plain positive quantities. The HQ-supplied forward sales come off once,
    // below, as an explicit deduction the statement can show.
    bucket.revenue += tx.totalAmount;
    bucket.modal += txModal;

    for (const item of tx.items) {
      accumulate(
        bucket.rows,
        item.masterProductId,
        item.masterProduct.name,
        item.masterProduct.variant,
        item.costPrice,
        item.qty
      );
    }

    if (!isForwardTransaction(tx)) continue;

    const target = isHqSupply ? forward.fromHq : forward.fromBranch;
    // Reported as positive magnitudes: the direction block shows what each side handled, and
    // the sign lives in the deduction line that subtracts the HQ half.
    target.revenue += tx.totalAmount;
    target.modal += txModal;
    target.qty += tx.items.reduce((s, i) => s + i.qty, 0);

    // Signed detail view, kept out of the channel tables so the sale is never counted twice.
    // Negative = HQ supplied it and no branch stock moved; positive = the branch's own stock.
    for (const item of tx.items) {
      accumulate(
        forwardRows,
        item.masterProductId,
        item.masterProduct.name,
        item.masterProduct.variant,
        item.costPrice,
        isHqSupply ? -item.qty : item.qty
      );
    }
  }

  const shopeeTable = finalize(shopee.rows);
  const tiktokTable = finalize(tiktok.rows);
  const offlineTable = finalize(offline.rows);
  const forwardTable = finalize(forwardRows);
  const shopeeTableTotal = shopeeTable.reduce((sum, r) => sum + r.jumlah, 0);
  const tiktokTableTotal = tiktokTable.reduce((sum, r) => sum + r.jumlah, 0);
  const offlineTableTotal = offlineTable.reduce((sum, r) => sum + r.jumlah, 0);
  const forwardTableTotal = forwardTable.reduce((sum, r) => sum + r.jumlah, 0);

  const modalOnline = shopee.modal + tiktok.modal;
  const modalTotal = modalOnline + offline.modal;

  // Gross invoiced, less what HQ supplied on the branch's behalf. Netting the revenue AND the
  // modal by the same sign is what keeps `omzet - modal = margin` honest: netting only the
  // revenue would show a Forward-from-HQ sale as negative omzet against positive cost and
  // manufacture a loss the branch never incurred.
  const netSales = totalInvoiced - forward.fromHq.revenue;
  const modalNet = modalTotal - forward.fromHq.modal;
  const margin = netSales - modalNet;

  return {
    branch,
    periodLabel: formatPeriodLabel(filters.startDate, filters.endDate),
    startDate: filters.startDate,
    endDate: filters.endDate,
    revenue: {
      shopee: shopee.revenue,
      tiktok: tiktok.revenue,
      offline: offline.revenue,
      totalInvoiced,
      lessForwardFromHq: forward.fromHq.revenue,
      netSales,
    },
    modal: {
      shopee: shopee.modal,
      tiktok: tiktok.modal,
      offline: offline.modal,
      online: modalOnline,
      total: modalTotal,
      lessForwardFromHq: forward.fromHq.modal,
      net: modalNet,
    },
    totals: {
      transactionCount: transactions.length,
      margin,
      marginPercentage: netSales > 0 ? (margin / netSales) * 100 : 0,
    },
    forward,
    shopeeTable,
    tiktokTable,
    offlineTable,
    forwardTable,
    shopeeTableTotal,
    tiktokTableTotal,
    offlineTableTotal,
    forwardTableTotal,
  };
}
