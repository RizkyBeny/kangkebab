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
  history: 'Riwayat Transaksi',
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
