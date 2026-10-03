export type UserRole = 'HQ_ADMIN' | 'CABANG_STAFF';

export type TabType =
  | 'analytics'
  | 'master'
  | 'dispatch'
  | 'reception'
  | 'pos'
  | 'live_products'
  | 'inventory_global'
  | 'reseller_prices'
  | 'history'
  | 'perhitungan';

export type SalesChannel = 'ONLINE' | 'OFFLINE';

export type OnlinePlatform = 'SHOPEE' | 'TIKTOK' | 'NONE';

/**
 * Which side physically supplied the goods for a Resi Forward sale. Only set on an ONLINE
 * sale; a non-null value is what marks that sale as a Resi Forward.
 *  - HQ     : HQ ships the buyer outside the branch area straight from HQ stock. The branch's
 *             own stock is NOT decremented, and the sale is NETTED OUT of the branch's
 *             revenue and modal (see `forwardSettlementSign`).
 *  - CABANG : HQ forwards the order to the branch. The branch's stock IS decremented and the
 *             branch keeps the sale in full.
 */
export type ForwardSource = 'HQ' | 'CABANG';

export type ShipmentStatus = 'DIKIRIM' | 'DITERIMA';

export type BelanjaOrderStatus = 'BARU' | 'DIKONFIRMASI' | 'SELESAI' | 'BATAL';

export type BelanjaFulfillment = 'PICKUP' | 'COURIER';

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
  resellerSellingPrice?: number | null;
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

export interface BelanjaOrderItem {
  id: string;
  orderId: string;
  masterProductId: string;
  masterProduct: MasterProduct;
  qty: number;
  unitPrice: number;
  costPrice: number;
}

export interface BelanjaOrder {
  id: string;
  orderNumber: string;
  branchId: string;
  branch: Branch;
  customerName: string;
  customerPhone: string;
  address?: string | null;
  fulfillment: BelanjaFulfillment;
  deliveryFee: number;
  notes?: string | null;
  status: BelanjaOrderStatus;
  totalAmount: number;
  totalCost: number;
  transactionNumber?: string | null;
  confirmedAt?: Date | string | null;
  createdAt: Date | string;
  items: BelanjaOrderItem[];
}

export interface SalesTransaction {
  id: string;
  transactionNumber: string;
  branchId: string;
  branch: Branch;
  channel: SalesChannel;
  platform?: OnlinePlatform | null;
  forwardSource?: ForwardSource | null;
  customerName: string;
  customerPhone: string;
  paymentStatus: string;
  paymentMethod: string;
  ecommerceActualPrice?: number | null;
  isReseller: boolean;
  discountPercent: number;
  discountAmount: number;
  totalAmount: number;
  totalCost: number;
  /** The business date the sale belongs to. Editable; drives period reports, the history list and
   *  the date segment of the invoice number. Defaults to the sale's `createdAt` for old rows. */
  transactionDate: Date | string;
  /** Immutable: when the row was actually written. Survives a business-date correction. */
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
  /** Net Resi Forward contribution to the branch: from-branch sales minus the HQ-supplied
   *  sales that are netted out. Can be negative for a branch that mostly forwards to HQ. */
  forwardRevenue: number;
  /** Forward sales supplied by HQ, as a POSITIVE magnitude. This is the amount excluded from
   *  `totalRevenue` and from each branch's figures. */
  forwardFromHqRevenue: number;
  shopeeRevenue: number;
  tiktokRevenue: number;
  branchPerformance: {
    branchId: string;
    branchName: string;
    branchCode: string;
    /** Net of HQ-supplied forward sales. */
    revenue: number;
    /** Net of HQ-supplied forward sales, summed from item rows. */
    cost: number;
    margin: number;
    transactionCount: number;
    damagedCount: number;
    offlineRevenue: number;
    forwardRevenue: number;
    forwardFromHqRevenue: number;
    shopeeRevenue: number;
    tiktokRevenue: number;
  }[];
  productPerformance: {
    masterProductId: string;
    sku: string;
    name: string;
    variant: string;
    qtySold: number;
    /** Units moved through Resi Forward, signed by direction: negative for HQ-supplied sales,
     *  which never left the branch's own stock. Split from `qtySold` so real sell-through
     *  stays readable. */
    forwardQty: number;
    remainingStock: number;
  }[];
}

/** One product line in a "Hari Perhitungan" table. */
export interface PerhitunganTableRow {
  name: string;
  variant: string;
  /** `MasterProduct.costPrice` — HQ's modal for the goods, labelled "Modal (COGS)" in
   *  Master Data & Pricing. Not a selling price: this table exists so the settlement can
   *  be checked as `omzet - modal = margin`. */
  hargaModal: number;
  /** Signed on `forwardTable` only: negative = supplied by HQ, positive = branch stock. The
   *  three channel tables describe what was actually sold, so their Qty is positive. */
  qty: number;
  /** This line's share of the modal, summed at each transaction's own modal price. */
  jumlah: number;
  /** True when HQ revised this product's modal during the period, so `qty * hargaModal` no
   *  longer reproduces `jumlah`. Displayed as a marker on the row. */
  mixedPrice?: boolean;
}

export interface PerhitunganReport {
  branch: Branch;
  periodLabel: string;
  startDate: string;
  endDate: string;
  /** Gross omzet per platform, i.e. what was invoiced. Resi Forward sales sit inside their own
   *  platform rather than forming a revenue line of their own, so these three lines already
   *  add up to `totalInvoiced`. */
  revenue: {
    shopee: number;
    tiktok: number;
    offline: number;
    totalInvoiced: number;
    /** Positive magnitude. Subtract it from `totalInvoiced` to reach `netSales`. */
    lessForwardFromHq: number;
    /** The branch's own sales. Every profit-share figure is based on this, not on
     *  `totalInvoiced`. */
    netSales: number;
  };
  /** Modal per channel, summed from `SalesTransactionItem.costPrice * qty` — never from the
   *  denormalised `SalesTransaction.totalCost`, which `updateSalesTransaction` leaves stale. */
  modal: {
    shopee: number;
    tiktok: number;
    offline: number;
    online: number;
    /** Gross, before netting. */
    total: number;
    /** Positive magnitude, mirroring `revenue.lessForwardFromHq`. */
    lessForwardFromHq: number;
    /** `total - lessForwardFromHq` — the modal the branch is actually charged. */
    net: number;
  };
  totals: {
    transactionCount: number;
    /** `revenue.netSales - modal.net`. The branch's gross margin, before `Pengeluaran`. */
    margin: number;
    /** `margin / revenue.netSales`. */
    marginPercentage: number;
  };
  forward: {
    fromHq: { revenue: number; modal: number; qty: number };
    fromBranch: { revenue: number; modal: number; qty: number };
  };
  /** One product table per sales channel, so every revenue line above has a breakdown and none
   *  of them is summary-only. The channel tables show gross, positive-only lines. */
  shopeeTable: PerhitunganTableRow[];
  tiktokTable: PerhitunganTableRow[];
  offlineTable: PerhitunganTableRow[];
  /** Detail view over the online Resi Forward sales only — NOT an additional revenue line, since
   *  those sales are already counted inside `shopeeTable` / `tiktokTable`. Carries the signed Qty
   *  convention: negative = supplied by HQ, positive = taken from the branch's own stock. */
  forwardTable: PerhitunganTableRow[];
  shopeeTableTotal: number;
  tiktokTableTotal: number;
  offlineTableTotal: number;
  forwardTableTotal: number;
}
