export type UserRole = 'HQ_ADMIN' | 'CABANG_STAFF';

export type TabType =
  | 'analytics'
  | 'master'
  | 'dispatch'
  | 'reception'
  | 'pos'
  | 'live_products'
  | 'inventory_global'
  | 'history';

export type SalesChannel = 'ONLINE' | 'OFFLINE';

export type OnlinePlatform = 'SHOPEE' | 'TIKTOK' | 'NONE';

export type ShipmentStatus = 'DIKIRIM' | 'DITERIMA';

export interface Branch {
  id: string;
  code: string;
  name: string;
  address?: string | null;
  createdAt: Date | string;
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  branchId?: string | null;
  branch?: Branch | null;
}

export interface MasterProduct {
  id: string;
  sku: string;
  name: string;
  variant: string;
  costPrice: number;
  offlineSellingPrice: number;
  shopeeSellingPrice: number;
  tiktokSellingPrice: number;
  createdAt: Date | string;
  updatedAt: Date | string;
}

export interface ShipmentItem {
  id: string;
  shipmentId: string;
  masterProductId: string;
  masterProduct: MasterProduct;
  costPrice: number;
  qtySent: number;
  qtyReceived: number;
  qtyDamaged: number;
}

export interface Shipment {
  id: string;
  shipmentNumber: string;
  branchId: string;
  branch: Branch;
  status: ShipmentStatus;
  sentAt: Date | string;
  receivedAt?: Date | string | null;
  items: ShipmentItem[];
}

export interface BranchInventory {
  id: string;
  branchId: string;
  branch?: Branch | null;
  masterProductId: string;
  masterProduct: MasterProduct;
  qtyAvailable: number;
  qtyDamaged: number;
}

export interface SalesTransactionItem {
  id: string;
  transactionId: string;
  masterProductId: string;
  masterProduct: MasterProduct;
  qty: number;
  sellingPrice: number;
  costPrice: number;
}

export interface SalesTransaction {
  id: string;
  transactionNumber: string;
  branchId: string;
  branch: Branch;
  channel: SalesChannel;
  platform?: OnlinePlatform | null;
  customerName: string;
  customerPhone: string;
  paymentStatus: string;
  paymentMethod: string;
  ecommerceActualPrice?: number | null;
  totalAmount: number;
  totalCost: number;
  createdAt: Date | string;
  items: SalesTransactionItem[];
}

export interface ConsolidatedFinancials {
  totalRevenue: number;
  totalCostOfGoods: number;
  grossMarginAmount: number;
  grossMarginPercentage: number;
  totalTransactionsCount: number;
  totalDamagedItemsCount: number;
  damagedGoodsValue: number;
  onlineRevenue: number;
  offlineRevenue: number;
  branchPerformance: {
    branchId: string;
    branchName: string;
    branchCode: string;
    revenue: number;
    cost: number;
    margin: number;
    transactionCount: number;
    damagedCount: number;
  }[];
  productPerformance: {
    masterProductId: string;
    sku: string;
    name: string;
    variant: string;
    qtySold: number;
    remainingStock: number;
  }[];
}
