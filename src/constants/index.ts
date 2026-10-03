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

/** Formats a Date as `YYYY-MM-DD` from its LOCAL date parts — the inverse of `parseLocalDate`,
 *  and the value shape `<input type="date">` speaks. Using `toISOString()` here instead would
 *  return the UTC day, which is the previous date for any sale made before 07:00 WIB. */
export function toISODateString(dateInput: Date | string): string {
  const d = new Date(dateInput);
  if (Number.isNaN(d.getTime())) return '';
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

/** Inclusive period bounds for a `YYYY-MM-DD` range, both from LOCAL date parts.
 *
 *  Every period filter in the app goes through here so the same range always selects the same
 *  transactions. This previously differed per service: the settlement report built local bounds
 *  while analytics and the transaction list built UTC ones, so on a WIB host "1-30 September"
 *  meant two different sets of rows depending on which screen you asked. */
export function getPeriodBounds(
  startDate?: string | null,
  endDate?: string | null
): { start?: Date; end?: Date } {
  const bounds: { start?: Date; end?: Date } = {};
  if (startDate) {
    const start = parseLocalDate(startDate);
    if (Number.isNaN(start.getTime())) throw new Error('Tanggal mulai tidak valid');
    bounds.start = start;
  }
  if (endDate) {
    const end = parseLocalDate(endDate);
    if (Number.isNaN(end.getTime())) throw new Error('Tanggal akhir tidak valid');
    end.setHours(23, 59, 59, 999);
    bounds.end = end;
  }
  if (bounds.start && bounds.end && bounds.end.getTime() < bounds.start.getTime()) {
    throw new Error('Tanggal akhir tidak boleh lebih awal dari tanggal mulai');
  }
  return bounds;
}

/** Resolves the business date for a transaction being created or edited.
 *
 *  Accepts a `YYYY-MM-DD` string (what the date input sends) or nothing, in which case the sale
 *  belongs to today. Parsed as local midnight so a late-evening sale never lands on tomorrow's
 *  report. A future date is rejected by default: a sale cannot have happened tomorrow, and
 *  allowing it would let a transaction be parked outside every settlement period until then. */
export function resolveTransactionDate(value?: string | null, options?: { allowFuture?: boolean }): Date {
  if (value === undefined || value === null || String(value).trim() === '') return new Date();

  const date = parseLocalDate(String(value).trim());
  if (Number.isNaN(date.getTime())) {
    throw new Error('Tanggal transaksi tidak valid');
  }
  if (!options?.allowFuture) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (date.getTime() > today.getTime()) {
      throw new Error('Tanggal transaksi tidak boleh di masa depan');
    }
  }
  return date;
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
