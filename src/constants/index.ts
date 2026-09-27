export const ROLES = {
  HQ_ADMIN: 'HQ_ADMIN',
  CABANG_STAFF: 'CABANG_STAFF',
} as const;

export const CHANNELS = {
  ONLINE: 'ONLINE',
  OFFLINE: 'OFFLINE',
} as const;

export const PLATFORMS = {
  SHOPEE: 'SHOPEE',
  TIKTOK: 'TIKTOK',
  NONE: 'NONE',
} as const;

export const FORWARD_SOURCES = {
  HQ: 'HQ',
  CABANG: 'CABANG',
} as const;

export const FORWARD_SOURCE_LABELS: Record<string, string> = {
  HQ: 'Barang dari HQ',
  CABANG: 'Barang dari Stok Cabang',
};

/**
 * Resi Forward is not a third sales channel — it is a marker on an ONLINE sale.
 *
 * HQ takes orders from buyers all over the country but only has stock at the branches, so an
 * order for a buyer outside the branch's area gets shipped straight from HQ while the sale is
 * still recorded against that branch. `forwardSource` is what records which side actually put
 * the goods in the box; `channel` stays `ONLINE` because the order was placed on a
 * marketplace. A non-null `forwardSource` is therefore the ONLY thing that marks a sale as
 * forward.
 */
export function isForwardTransaction(tx: { forwardSource?: string | null }): boolean {
  return tx.forwardSource === 'HQ' || tx.forwardSource === 'CABANG';
}

/**
 * Settlement sign for a Resi Forward sale: what the branch keeps towards revenue and modal.
 *
 *  - `HQ`     -> -1. The branch neither supplied nor shipped the goods, so both the revenue and
 *                the modal it would otherwise be credited with are removed from the branch's
 *                figures. The sale still appears on the statement, as a deduction.
 *  - `CABANG` -> +1. The branch supplied and shipped the goods, so it keeps them in full.
 *  - not forward -> +1. An ordinary sale is never netted.
 *
 * Netting revenue and modal by the same sign is what keeps `margin = revenue - modal` honest:
 * the HQ portion's margin comes out of the branch's profit share rather than being counted as
 * the branch's own while its cost is also counted.
 */
export function forwardSettlementSign(tx: { forwardSource?: string | null }): 1 | -1 {
  return isForwardTransaction(tx) && tx.forwardSource === 'HQ' ? -1 : 1;
}

export const SHIPMENT_STATUS = {
  DIKIRIM: 'DIKIRIM',
  DITERIMA: 'DITERIMA',
} as const;

import { TabType } from '@/types';

export const TAB_LABELS: Record<TabType, string> = {
  analytics: 'Konsolidasi',
  master: 'Master Data & Pricing',
  dispatch: 'Pengiriman ke Cabang',
  reception: 'Terima & Validasi Barang',
  pos: 'POS Kasir Multichannel',
  live_products: 'Katalog Live Product',
  inventory_global: 'Stok Opname Cabang',
  reseller_prices: 'Harga Reseller',
  history: 'Riwayat Transaksi',
  perhitungan: 'Laporan Perhitungan',
};

export function formatRupiah(amount: number): string {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatDate(dateInput: Date | string): string {
  const date = new Date(dateInput);
  return new Intl.DateTimeFormat('id-ID', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
}

export function formatShortDate(dateInput: Date | string): string {
  const date = new Date(dateInput);
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${yyyy}${mm}${dd}`;
}

const INDONESIAN_MONTHS = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
];

/** Parses a `YYYY-MM-DD` string into a LOCAL midnight Date.
 *  Avoids `new Date('2026-09-01')`, which is parsed as UTC and silently drops the
 *  first 7 hours of the day in WIB — which undercounts a daily settlement report. */
export function parseLocalDate(value: string): Date {
  const [y, m, d] = value.split('-').map(Number);
  if (!y || !m || !d) return new Date(value);
  return new Date(y, m - 1, d, 0, 0, 0, 0);
}

/** Formats a period as it appears on the report header, e.g. `1-31 Agustus 2026`. */
export function formatPeriodLabel(startDate: string, endDate: string): string {
  const start = parseLocalDate(startDate);
  const end = parseLocalDate(endDate);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return `${startDate} - ${endDate}`;

  const startDay = start.getDate();
  const endDay = end.getDate();
  const endMonth = INDONESIAN_MONTHS[end.getMonth()];
  const endYear = end.getFullYear();

  if (start.getFullYear() === end.getFullYear() && start.getMonth() === end.getMonth()) {
    return `${startDay}-${endDay} ${endMonth} ${endYear}`;
  }
  if (start.getFullYear() === end.getFullYear()) {
    return `${startDay} ${INDONESIAN_MONTHS[start.getMonth()]} - ${endDay} ${endMonth} ${endYear}`;
  }
  return `${startDay} ${INDONESIAN_MONTHS[start.getMonth()]} ${start.getFullYear()} - ${endDay} ${endMonth} ${endYear}`;
}
