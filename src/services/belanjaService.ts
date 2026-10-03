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
    const qty = Math.floor(Number(it.qty));
    // `Number.isFinite` is load-bearing: `Math.floor('abc')` is NaN and `NaN < 1` is false, so a
    // plain `qty < 1` check would let the line through and then die on a raw Postgres
    // "invalid input syntax for type integer: NaN" instead of a usable validation message.
    if (!Number.isFinite(qty) || qty < 1) continue;
    mergedLines.set(it.masterProductId, (mergedLines.get(it.masterProductId) ?? 0) + qty);
  }
  if (mergedLines.size === 0) {
    throw new Error('Keranjang belanja tidak boleh kosong');
  }

  const branch = await prisma.branch.findUnique({ where: { id: data.branchId } });
  if (!branch) throw new Error('Cabang tidak ditemukan');

  // Price snapshot at checkout = reseller price (fallback to offline price), exactly what POS resolves.
  // Read OUTSIDE the stock transaction on purpose: this is reference data (the product's price), not
  // the contended stock row, so it needs no lock. Stock availability is deliberately NOT checked here
  // — see the guarded decrement below for why a check at this point is worthless.
  let totalAmount = 0;
  let totalCost = 0;
  let totalQty = 0;
  const itemData: { masterProductId: string; qty: number; unitPrice: number; costPrice: number }[] = [];

  for (const [masterProductId, qty] of mergedLines) {
    const inventory = await prisma.branchInventory.findUnique({
      where: {
        branchId_masterProductId: { branchId: data.branchId, masterProductId },
      },
      include: { masterProduct: true },
    });

    if (!inventory) {
      throw new Error('Stok produk tidak ditemukan di cabang ini');
    }

    const prod = inventory.masterProduct;
    if (!prod.isActive) {
      throw new Error(`Produk ${prod.name} sudah tidak aktif dan tidak bisa dipesan`);
    }

    const unitPrice = inventory.resellerSellingPrice ?? prod.offlineSellingPrice;
    totalAmount += unitPrice * qty;
    totalCost += prod.costPrice * qty;
    totalQty += qty;
    itemData.push({ masterProductId, qty, unitPrice, costPrice: prod.costPrice });
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

      // Interactive transaction, because the stock guard has to be able to ABORT the whole thing.
      // The previous check-then-decrement read availability outside any transaction, so two
      // simultaneous checkouts for the same product both saw enough stock, both passed, and both
      // decremented — leaving `qtyAvailable` negative. Here the guard is part of the write:
      // `qtyAvailable: { gte: qty }` makes Postgres re-test availability under the row lock at the
      // moment of the UPDATE, so the loser of the race matches 0 rows and rolls the whole order back.
      const createdOrder = await prisma.$transaction(async (tx) => {
        for (const line of itemData) {
          const claimed = await tx.branchInventory.updateMany({
            where: {
              branchId: branch.id,
              masterProductId: line.masterProductId,
              qtyAvailable: { gte: line.qty },
            },
            data: { qtyAvailable: { decrement: line.qty } },
          });

          if (claimed.count !== 1) {
            // Re-read for a useful message. This is the only place availability is observed, and
            // observing it is safe: the decision to write has already been made and failed.
            const current = await tx.branchInventory.findUnique({
              where: {
                branchId_masterProductId: {
                  branchId: branch.id,
                  masterProductId: line.masterProductId,
                },
              },
              include: { masterProduct: { select: { name: true } } },
            });
            const prodName = current?.masterProduct?.name || 'Produk';
            throw new Error(
              `Stok ${prodName} tidak mencukupi (Tersedia: ${current?.qtyAvailable ?? 0}, Diminta: ${line.qty})`
            );
          }
        }

        await tx.salesTransaction.create({
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
            transactionDate: new Date(),
            items: {
              create: itemData.map((i) => ({
                masterProductId: i.masterProductId,
                qty: i.qty,
                sellingPrice: i.unitPrice,
                costPrice: i.costPrice,
              })),
            },
          },
        });

        const order = await tx.belanjaOrder.create({
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
        });

        // Inside the transaction on purpose. Written after the commit it used to fail on its own,
        // which returned "gagal" to the customer for an order that had already been placed — and the
        // customer, seeing the error, submitted again and got a duplicate order plus a second
        // stock decrement.
        await tx.auditLog.create({
          data: {
            userId: 'PUBLIC',
            userName: 'Katalog Belanja',
            action: 'CREATE_BELANJA_ORDER',
            entity: 'BelanjaOrder',
            entityId: order.id,
            details: `Pesanan ${orderNumber} diproses otomatis via katalog belanja di ${branch.name}. Invoice ${transactionNumber}, ${totalQty} unit stok terkurangi. Total: Rp ${totalAmount}`,
          },
        });

        return order;
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