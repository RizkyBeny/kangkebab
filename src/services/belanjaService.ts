import { prisma } from '@/lib/prisma';
import { sseBroadcaster } from '@/lib/sseEmitter';
import { getNextInvoiceSequence } from './posService';
import { BelanjaOrder, BelanjaFulfillment } from '@/types';
import { formatShortDate } from '@/constants';

function isUniqueConstraintError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    (error as { code?: string }).code === 'P2002'
  );
}

// Atomically reserve the next Belanja order number (BLJ/<code>/YYYYMMDD/<seq>) for a branch.
// Uses its own "BLJ" counter namespace so it never collides with the INV invoice sequence.
async function getNextBelanjaSequence(branchId: string, branchCode: string, date: string): Promise<number> {
  const rows: { seq: number }[] = await prisma.$queryRaw`
    WITH existing_max AS (
      SELECT COALESCE(MAX(NULLIF(SPLIT_PART("orderNumber", '/', 4), '')::int), 0) AS mx
      FROM "BelanjaOrder"
      WHERE "branchId" = ${branchId}
        AND "orderNumber" LIKE ${`BLJ/${branchCode}/${date}/%`}
        AND SPLIT_PART("orderNumber", '/', 4) ~ '^[0-9]+$'
    )
    INSERT INTO "TransactionCounter" ("id", "branchId", "date", "kind", "lastNumber")
    SELECT gen_random_uuid(), ${branchId}, ${date}, 'BLJ', mx + 1
    FROM existing_max
    ON CONFLICT ("branchId", "date", "kind")
    DO UPDATE SET "lastNumber" = "TransactionCounter"."lastNumber" + 1
    RETURNING "lastNumber" AS "seq"
  `;
  return Number(rows[0].seq);
}

// Auto-processed order: one atomic batch decrements stock, issues the reseller invoice
// (OFFLINE, reusing the INV sequence shared with POS), and marks the order DIKONFIRMASI.
export async function createBelanjaOrder(data: {
  branchId: string;
  customerName: string;
  customerPhone: string;
  fulfillment: BelanjaFulfillment;
  address?: string | null;
  deliveryFee?: number;
  notes?: string | null;
  paymentMethod?: string;
  items: { masterProductId: string; qty: number }[];
}): Promise<BelanjaOrder> {
  if (!data.items || data.items.length === 0) {
    throw new Error('Keranjang belanja tidak boleh kosong');
  }
  if (!data.customerName || !data.customerPhone) {
    throw new Error('Nama dan No. Handphone wajib diisi');
  }

  const fulfillment: BelanjaFulfillment = data.fulfillment === 'COURIER' ? 'COURIER' : 'PICKUP';
  if (fulfillment === 'COURIER' && !data.address?.trim()) {
    throw new Error('Alamat pengiriman wajib diisi untuk pengiriman kurir');
  }
  const deliveryFee = fulfillment === 'PICKUP' ? 0 : Math.max(0, Number(data.deliveryFee) || 0);
  const notes = data.notes?.trim() ? data.notes.trim() : null;
  const paymentMethod = data.paymentMethod || 'CASH';

  // Merge duplicate line items and drop invalid ones.
  const mergedLines = new Map<string, number>();
  for (const it of data.items) {
    if (!it.masterProductId) continue;
    const qty = Math.floor(it.qty);
    if (qty < 1) continue;
    mergedLines.set(it.masterProductId, (mergedLines.get(it.masterProductId) ?? 0) + qty);
  }
  if (mergedLines.size === 0) {
    throw new Error('Keranjang belanja tidak boleh kosong');
  }

  const branch = await prisma.branch.findUnique({ where: { id: data.branchId } });
  if (!branch) throw new Error('Cabang tidak ditemukan');

  // Price snapshot at checkout = reseller price (fallback to offline price), exactly what POS resolves.
  let totalAmount = 0;
  let totalCost = 0;
  let totalQty = 0;
  const itemData: { masterProductId: string; qty: number; unitPrice: number; costPrice: number }[] = [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const operations: any[] = [];

  for (const [masterProductId, qty] of mergedLines) {
    const inventory = await prisma.branchInventory.findUnique({
      where: {
        branchId_masterProductId: { branchId: data.branchId, masterProductId },
      },
      include: { masterProduct: true },
    });

    if (!inventory || inventory.qtyAvailable < qty) {
      const prodName = inventory?.masterProduct?.name || 'Produk';
      throw new Error(`Stok ${prodName} tidak mencukupi (Tersedia: ${inventory?.qtyAvailable || 0}, Diminta: ${qty})`);
    }

    const prod = inventory.masterProduct;
    const unitPrice = inventory.resellerSellingPrice ?? prod.offlineSellingPrice;
    totalAmount += unitPrice * qty;
    totalCost += prod.costPrice * qty;
    totalQty += qty;
    itemData.push({ masterProductId, qty, unitPrice, costPrice: prod.costPrice });

    // Atomically decrement stock in the same transaction as the invoice + order.
    operations.push(
      prisma.branchInventory.update({
        where: { id: inventory.id },
        data: { qtyAvailable: { decrement: qty } },
      })
    );
  }

  const todayStr = formatShortDate(new Date());
  const MAX_ATTEMPTS = 3;
  let lastError: unknown;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const orderSeq = await getNextBelanjaSequence(branch.id, branch.code, todayStr);
      const orderNumber = `BLJ/${branch.code}/${todayStr}/${String(orderSeq).padStart(4, '0')}`;
      const invoiceSeq = await getNextInvoiceSequence(branch.id, branch.code, todayStr);
      const transactionNumber = `INV/${branch.code}/${todayStr}/${String(invoiceSeq).padStart(4, '0')}`;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const batch: any[] = [
        ...operations,
        prisma.salesTransaction.create({
          data: {
            transactionNumber,
            branchId: branch.id,
            channel: 'OFFLINE',
            platform: 'NONE',
            customerName: data.customerName,
            customerPhone: data.customerPhone,
            paymentStatus: 'PAID',
            paymentMethod,
            isReseller: true,
            discountPercent: 0,
            discountAmount: 0,
            totalAmount,
            totalCost,
            items: {
              create: itemData.map((i) => ({
                masterProductId: i.masterProductId,
                qty: i.qty,
                sellingPrice: i.unitPrice,
                costPrice: i.costPrice,
              })),
            },
          },
        }),
        prisma.belanjaOrder.create({
          data: {
            orderNumber,
            branchId: branch.id,
            customerName: data.customerName,
            customerPhone: data.customerPhone,
            address: fulfillment === 'COURIER' ? (data.address?.trim() ?? null) : null,
            fulfillment,
            deliveryFee,
            notes,
            status: 'DIKONFIRMASI',
            transactionNumber,
            confirmedAt: new Date(),
            totalAmount: totalAmount + deliveryFee,
            totalCost,
            items: { create: itemData },
          },
          include: { branch: true, items: { include: { masterProduct: true } } },
        }),
      ];

      const results = await prisma.$transaction(batch);
      const createdOrder = results[results.length - 1];

      await prisma.auditLog.create({
        data: {
          userId: 'PUBLIC',
          userName: 'Katalog Belanja',
          action: 'CREATE_BELANJA_ORDER',
          entity: 'BelanjaOrder',
          entityId: createdOrder.id,
          details: `Pesanan ${orderNumber} diproses otomatis via katalog belanja di ${branch.name}. Invoice ${transactionNumber}, ${totalQty} unit stok terkurangi. Total: Rp ${totalAmount}`,
        },
      });

      sseBroadcaster.emit('SALES_UPDATED', {
        type: 'TRANSACTION_CREATED',
        branchId: branch.id,
        transactionNumber,
        timestamp: new Date().toISOString(),
      });

      return createdOrder as unknown as BelanjaOrder;
    } catch (error) {
      lastError = error;
      if (isUniqueConstraintError(error) && attempt < MAX_ATTEMPTS) continue;
      throw error;
    }
  }
  throw lastError;
}