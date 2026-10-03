import { prisma } from '@/lib/prisma';
import { sseBroadcaster } from '@/lib/sseEmitter';
import { SalesTransaction, SalesChannel, OnlinePlatform, ForwardSource } from '@/types';
import { FORWARD_SOURCE_LABELS, formatShortDate, getPeriodBounds, resolveTransactionDate, toISODateString } from '@/constants';

function isUniqueConstraintError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    (error as { code?: string }).code === 'P2002'
  );
}

/** A Resi Forward sale is stored as an ordinary ONLINE sale plus a `forwardSource` marker, so
 *  the only thing that decides whether branch stock moves is which side shipped the goods. */
function shouldDeductStock(forwardSource?: string | null): boolean {
  return forwardSource !== 'HQ';
}

function describeForwardSource(forwardSource?: string | null): string {
  if (!forwardSource) return '';
  return FORWARD_SOURCE_LABELS[forwardSource] || forwardSource;
}

// Atomically reserve the next invoice sequence for a branch on a given date (YYYYMMDD).
// If no counter row exists yet, it seeds from the actual MAX suffix already present in
// SalesTransaction (so numbering survives deletions). A single INSERT ... ON CONFLICT DO
// UPDATE claims a distinct number under a row lock and ALWAYS returns a row, so concurrent
// requests never collide and never get skipped.
export async function getNextInvoiceSequence(branchId: string, branchCode: string, date: string): Promise<number> {
  const rows: { seq: number }[] = await prisma.$queryRaw`
    WITH existing_max AS (
      SELECT COALESCE(MAX(NULLIF(SPLIT_PART("transactionNumber", '/', 4), '')::int), 0) AS mx
      FROM "SalesTransaction"
      WHERE "branchId" = ${branchId}
        AND "transactionNumber" LIKE ${`INV/${branchCode}/${date}/%`}
        AND SPLIT_PART("transactionNumber", '/', 4) ~ '^[0-9]+$'
    )
    INSERT INTO "TransactionCounter" ("id", "branchId", "date", "kind", "lastNumber")
    SELECT gen_random_uuid(), ${branchId}, ${date}, 'INV', mx + 1
    FROM existing_max
    ON CONFLICT ("branchId", "date", "kind")
    DO UPDATE SET "lastNumber" = "TransactionCounter"."lastNumber" + 1
    RETURNING "lastNumber" AS "seq"
  `;
  return Number(rows[0].seq);
}

export async function createSalesTransaction(data: {
  branchId: string;
  channel: SalesChannel;
  platform?: OnlinePlatform | null;
  forwardSource?: ForwardSource | null;
  items: { masterProductId: string; qty: number; customPrice?: number }[];
  userId: string;
  userName: string;
  customerName: string;
  customerPhone: string;
  paymentStatus: string;
  paymentMethod: string;
  ecommerceActualPrice?: number | null;
  isReseller?: boolean;
  discountPercent?: number;
  /** `YYYY-MM-DD` business date. Defaults to today. Drives both the stored `transactionDate` and
   *  the date segment of the invoice number, so a backdated sale is numbered for the day it
   *  belongs to rather than the day it was keyed in. */
  transactionDate?: string | null;
}): Promise<SalesTransaction> {
  if (data.items.length === 0) {
    throw new Error('Keranjang belanja tidak boleh kosong');
  }

  if (data.channel === 'ONLINE' && (!data.platform || data.platform === 'NONE')) {
    throw new Error('Wajib memilih platform e-commerce (Shopee atau TikTok) untuk transaksi Online');
  }

  if (data.channel === 'ONLINE' && (data.ecommerceActualPrice === undefined || data.ecommerceActualPrice === null || data.ecommerceActualPrice <= 0)) {
    throw new Error('Harga Actual Ecommerce wajib diisi untuk transaksi Online');
  }

  // Resi Forward is a marker on an ONLINE sale, not a channel of its own. A `forwardSource` is
  // only meaningful (and only accepted) on ONLINE, and must name the side that shipped.
  const wantsForward = data.forwardSource === 'HQ' || data.forwardSource === 'CABANG';
  const isForward = data.channel === 'ONLINE' && wantsForward;
  let forwardSource: ForwardSource | null = null;
  if (isForward) {
    forwardSource = data.forwardSource as ForwardSource;
  } else if (wantsForward) {
    throw new Error('Resi Forward hanya berlaku untuk penjualan Online');
  }
  const deductStock = shouldDeductStock(forwardSource);

  const isReseller = data.channel === 'OFFLINE' && !!data.isReseller;
  let discountPercent = 0;
  if (isReseller && data.discountPercent != null) {
    discountPercent = Number(data.discountPercent);
    if (!Number.isFinite(discountPercent) || discountPercent < 0 || discountPercent > 100) {
      throw new Error('Diskon reseller harus antara 0% dan 100%');
    }
  }

  const branch = await prisma.branch.findUnique({ where: { id: data.branchId } });
  if (!branch) throw new Error('Cabang tidak ditemukan');

  // The business date the sale belongs to. Resolved (and validated) before the invoice number is
  // drawn, because the number's date segment must come from this date and not the wall clock —
  // otherwise a backdated sale would be numbered for today and land in the wrong settlement period.
  const transactionDate = resolveTransactionDate(data.transactionDate);

  // Invoice number format: INV/CBG01/20260827/0001
  const dateStr = formatShortDate(transactionDate);

  let grandTotalAmount = 0;
  let grandTotalCost = 0;
  const transactionItemsData: { masterProductId: string; qty: number; sellingPrice: number; costPrice: number }[] = [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const baseOperations: any[] = [];

  // Validate inventory & calculate totals outside the main transaction array (using individual reads).
  // This avoids Interactive Transaction limits on Supabase PgBouncer.
  for (const cartItem of data.items) {
    const qty = Math.floor(cartItem.qty);
    if (!Number.isFinite(qty) || qty < 1) {
      throw new Error('Jumlah produk pada transaksi harus berupa bilangan bulat positif');
    }

    const prod = await prisma.masterProduct.findUnique({
      where: { id: cartItem.masterProductId },
    });
    if (!prod) throw new Error('Produk tidak ditemukan');
    // A discontinued (soft-deleted) product must not be sellable through the POS either, matching
    // the storefront filter in /api/katalog.
    if (!prod.isActive) throw new Error(`Produk ${prod.name} sudah tidak aktif dan tidak bisa dijual`);

    // A Forward sale supplied by HQ never touches branch stock, so there is no
    // BranchInventory row to read (or validate) for that direction.
    let inventoryId: string | null = null;
    let resellerPrice: number | null = null;
    if (deductStock) {
      const inventory = await prisma.branchInventory.findUnique({
        where: {
          branchId_masterProductId: {
            branchId: data.branchId,
            masterProductId: cartItem.masterProductId,
          },
        },
      });
      if (!inventory || inventory.qtyAvailable < qty) {
        throw new Error(
          `Stok ${prod.name} tidak mencukupi (Tersedia: ${inventory?.qtyAvailable || 0}, Diminta: ${qty})`
        );
      }
      inventoryId = inventory.id;
      resellerPrice = inventory.resellerSellingPrice;
    }

    // Auto-lock price based on channel & platform, or override with custom price if provided
    const autoPrice =
      data.channel === 'ONLINE'
        ? data.platform === 'SHOPEE'
          ? prod.shopeeSellingPrice
          : prod.tiktokSellingPrice
        : isReseller
          ? (resellerPrice ?? prod.offlineSellingPrice)
          : prod.offlineSellingPrice;
    const sellingPrice = data.items.find(i => i.masterProductId === cartItem.masterProductId)?.customPrice ?? autoPrice;
    const itemSubtotal = sellingPrice * qty;
    // Modal is recorded at cost even when no stock moved (Forward-from-HQ). The sale is netted
    // out of the branch at READ time via `forwardSettlementSign`, so storing the real cost here
    // keeps the signed modal and the signed revenue cancelling out in the settlement.
    const itemCostTotal = prod.costPrice * qty;

    grandTotalAmount += itemSubtotal;
    grandTotalCost += itemCostTotal;

    transactionItemsData.push({
      masterProductId: cartItem.masterProductId,
      qty,
      sellingPrice,
      costPrice: prod.costPrice,
    });

    // Atomically decrement stock (skipped entirely when HQ supplies the goods)
    if (inventoryId) {
      baseOperations.push(
        prisma.branchInventory.update({
          where: { id: inventoryId },
          data: {
            qtyAvailable: { decrement: qty },
          },
        })
      );
    }
  }

  // For ONLINE transactions, the ecommerce actual price IS the primary amount (overrides computed total)
  // For OFFLINE reseller transactions, apply the percentage discount to the item subtotal server-side.
  let discountAmount = 0;
  if (isReseller && discountPercent > 0 && grandTotalAmount > 0) {
    discountAmount = Math.min(Math.round((grandTotalAmount * discountPercent) / 100), grandTotalAmount);
  }
  const finalTotalAmount =
    data.channel === 'ONLINE' ? (data.ecommerceActualPrice ?? grandTotalAmount) : grandTotalAmount - discountAmount;

  // Reserve the invoice number atomically, then create the transaction. Retry on a unique
  // violation as a safety net; a failed batch rolls back (stock is untouched), so re-running
  // with a freshly reserved number is safe.
  const MAX_ATTEMPTS = 3;
  let lastError: unknown;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const seq = await getNextInvoiceSequence(branch.id, branch.code, dateStr);
      const transactionNumber = `INV/${branch.code}/${dateStr}/${String(seq).padStart(4, '0')}`;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const operations: any[] = [
        ...baseOperations,
        // Create SalesTransaction record
        prisma.salesTransaction.create({
          data: {
            transactionNumber,
            branchId: data.branchId,
            channel: data.channel,
            platform: data.channel === 'ONLINE' ? data.platform : 'NONE',
            forwardSource,
            customerName: data.customerName,
            customerPhone: data.customerPhone,
            paymentStatus: data.paymentStatus,
            paymentMethod: data.paymentMethod,
            ecommerceActualPrice: data.channel === 'ONLINE' ? data.ecommerceActualPrice : null,
            isReseller,
            discountPercent: isReseller ? discountPercent : 0,
            discountAmount: isReseller ? discountAmount : 0,
            totalAmount: finalTotalAmount,
            totalCost: grandTotalCost,
            transactionDate,
            items: {
              create: transactionItemsData,
            },
          },
          include: {
            branch: true,
            items: {
              include: {
                masterProduct: true,
              },
            },
          },
        }),
        // Audit Log
        prisma.auditLog.create({
          data: {
            userId: data.userId,
            userName: data.userName,
            action: 'CREATE_SALES_TRANSACTION',
            entity: 'SalesTransaction',
            // entityId can't be chained after execution in a Sequential Transaction batch,
            // so we save the transaction number instead.
            details: `Transaksi ${transactionNumber} (${data.channel}${data.platform ? ' - ' + data.platform : ''}${isForward ? ' - ' + describeForwardSource(forwardSource) : ''}) diselesaikan di ${branch.name}. Total: Rp ${finalTotalAmount}${isForward ? (deductStock ? ' (stok cabang berkurang)' : ' (stok cabang tidak berubah)') : ''}`,
          },
        }),
      ];

      // Execute all write operations as a sequential transaction
      const results = await prisma.$transaction(operations);
      const createdTx = results[results.length - 2]; // The salesTransaction.create is second to last

      // Emit real-time stock update via SSE
      sseBroadcaster.emit('SALES_UPDATED', {
        type: 'TRANSACTION_CREATED',
        branchId: data.branchId,
        transactionNumber,
        timestamp: new Date().toISOString(),
      });

      return createdTx as unknown as SalesTransaction;
    } catch (error) {
      lastError = error;
      if (isUniqueConstraintError(error) && attempt < MAX_ATTEMPTS) continue;
      throw error;
    }
  }
  throw lastError;
}

export async function getSalesTransactions(filters?: {
  branchId?: string;
  channel?: SalesChannel;
  startDate?: string;
  endDate?: string;
}): Promise<SalesTransaction[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const whereCondition: any = {};

  if (filters?.branchId) {
    whereCondition.branchId = filters.branchId;
  }

  if (filters?.channel) {
    whereCondition.channel = filters.channel;
  }

  // Period filters run on the business date, and the bounds come from `getPeriodBounds` so they are
  // built from LOCAL date parts. This used to use `new Date(filters.startDate)` (parsed as UTC) with
  // `setUTCHours(23,59,59,999)`, which on a WIB host dropped the first 7 hours of the period and
  // pulled in the first 7 hours of the day after it — and disagreed with the settlement report,
  // which had already been building local bounds.
  const { start, end } = getPeriodBounds(filters?.startDate, filters?.endDate);
  if (start || end) {
    whereCondition.transactionDate = {};
    if (start) whereCondition.transactionDate.gte = start;
    if (end) whereCondition.transactionDate.lte = end;
  }

  const transactions = await prisma.salesTransaction.findMany({
    where: whereCondition,
    include: {
      branch: true,
      items: {
        include: {
          masterProduct: true,
        },
      },
    },
    // Business date first so a corrected date reorders the history list as the user expects;
    // `createdAt` breaks ties between sales sharing a date.
    orderBy: [{ transactionDate: 'desc' }, { createdAt: 'desc' }],
  });

  return transactions as unknown as SalesTransaction[];
}

export async function updateSalesTransaction(
  id: string,
  data: {
    ecommerceActualPrice?: number | null;
    paymentMethod?: string;
    paymentStatus?: string;
    items?: { id: string; qty: number; sellingPrice: number }[];
    discountPercent?: number | null;
    /** `YYYY-MM-DD` business date. Omitted means "leave it alone". */
    transactionDate?: string | null;
    userId?: string;
    userName?: string;
  }
): Promise<SalesTransaction> {
  const existingTx = await prisma.salesTransaction.findUnique({
    where: { id },
    include: { items: true },
  });

  if (!existingTx) throw new Error('Transaksi tidak ditemukan');

  // Resolved up front so an invalid or future date is rejected before anything is written.
  // `undefined` means the caller did not touch the date, which is different from clearing it.
  const nextTransactionDate =
    data.transactionDate === undefined ? null : resolveTransactionDate(data.transactionDate);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const operations: any[] = [];
  let baseAmount = existingTx.totalAmount;

  if (data.items && data.items.length > 0) {
    // We update each item's qty and sellingPrice.
    // NOTE: If qty changes, we should ideally adjust inventory, but since this is history editing,
    // we assume the user only fixes mistakes or edits prices.
    // For simplicity, we just update the transaction item values and recalculate totals.
    let calcTotalAmount = 0;
    
    for (const item of data.items) {
      const existingItem = existingTx.items.find(i => i.id === item.id);
      if (existingItem) {
        // These reached the database unchecked before, so a NaN or negative qty/price could be
        // persisted straight onto the ledger.
        const qty = Math.floor(Number(item.qty));
        const sellingPrice = Number(item.sellingPrice);
        if (!Number.isFinite(qty) || qty < 0) {
          throw new Error(`Jumlah untuk ${existingItem.masterProductId} harus bilangan bulat >= 0`);
        }
        if (!Number.isFinite(sellingPrice) || sellingPrice < 0) {
          throw new Error(`Harga jual untuk ${existingItem.masterProductId} harus angka >= 0`);
        }

        calcTotalAmount += qty * sellingPrice;
        
        operations.push(
          prisma.salesTransactionItem.update({
            where: { id: item.id },
            data: {
              qty,
              sellingPrice,
            }
          })
        );
      }
    }
    baseAmount = calcTotalAmount;
  }
  baseAmount = Math.max(0, baseAmount);

  // Percentage discount only applies to OFFLINE reseller transactions; compute server-side.
  let discountPercent = existingTx.discountPercent || 0;
  if (existingTx.channel === 'OFFLINE' && existingTx.isReseller && data.discountPercent !== undefined && data.discountPercent !== null) {
    discountPercent = Number(data.discountPercent);
    if (!Number.isFinite(discountPercent) || discountPercent < 0 || discountPercent > 100) {
      throw new Error('Diskon reseller harus antara 0% dan 100%');
    }
  }
  let newTotalAmount = baseAmount;
  if (existingTx.channel === 'OFFLINE' && existingTx.isReseller && discountPercent > 0) {
    const discountAmount = Math.min(Math.round((baseAmount * discountPercent) / 100), baseAmount);
    newTotalAmount = baseAmount - discountAmount;
  }

  // If ecommerceActualPrice is provided, it completely overrides the totalAmount
  if (data.ecommerceActualPrice !== undefined && data.ecommerceActualPrice !== null) {
    newTotalAmount = data.ecommerceActualPrice;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const updateData: any = {
    totalAmount: newTotalAmount,
    discountPercent: existingTx.channel === 'OFFLINE' && existingTx.isReseller ? discountPercent : 0,
    discountAmount:
      existingTx.channel === 'OFFLINE' && existingTx.isReseller
        ? Math.max(0, baseAmount - newTotalAmount)
        : 0,
  };

  if (data.ecommerceActualPrice !== undefined) {
    updateData.ecommerceActualPrice = data.ecommerceActualPrice;
  }
  if (data.paymentMethod !== undefined) {
    updateData.paymentMethod = data.paymentMethod;
  }
  if (data.paymentStatus !== undefined) {
    updateData.paymentStatus = data.paymentStatus;
  }
  if (nextTransactionDate) {
    updateData.transactionDate = nextTransactionDate;
  }

  operations.push(
    prisma.salesTransaction.update({
      where: { id },
      data: updateData,
      include: {
        branch: true,
        items: {
          include: {
            masterProduct: true,
          },
        },
      },
    })
  );

  // This function wrote no audit trail at all before, so a corrected date or a re-priced receipt
  // left no record that the ledger had been edited. The date change is called out explicitly
  // (old -> new) because it silently moves the sale to a different settlement period.
  const dateChanged =
    nextTransactionDate !== null &&
    toISODateString(nextTransactionDate) !== toISODateString(existingTx.transactionDate);

  if (dateChanged) {
    operations.push(
      prisma.auditLog.create({
        data: {
          userId: data.userId || 'UNKNOWN',
          userName: data.userName || 'Tidak diketahui',
          action: 'UPDATE_SALES_TRANSACTION_DATE',
          entity: 'SalesTransaction',
          entityId: id,
          details: `${data.userName || 'Seseorang'} mengubah tanggal transaksi ${existingTx.transactionNumber} dari ${toISODateString(existingTx.transactionDate)} menjadi ${toISODateString(nextTransactionDate)}. Nomor struk tidak berubah.`,
        },
      })
    );
  }

  const results = await prisma.$transaction(operations);
  const updatedTx = results[results.length - 1];

  sseBroadcaster.emit('SALES_UPDATED', {
    type: 'TRANSACTION_UPDATED',
    branchId: updatedTx.branchId,
    transactionNumber: updatedTx.transactionNumber,
    timestamp: new Date().toISOString(),
  });

  return updatedTx as unknown as SalesTransaction;
}

export async function deleteSalesTransaction(data: {
  id: string;
  branchId: string;
  userId: string;
  userName: string;
}): Promise<void> {
  await deleteSalesTransactions({
    ids: [data.id],
    branchId: data.branchId,
    userId: data.userId,
    userName: data.userName,
  });
}

export async function deleteSalesTransactions(data: {
  ids: string[];
  branchId: string;
  userId: string;
  userName: string;
}): Promise<number> {
  const ids = [...new Set(data.ids)];
  if (ids.length === 0) return 0;

  const existingTxs = await prisma.salesTransaction.findMany({
    where: { id: { in: ids } },
    include: {
      branch: true,
      items: { include: { masterProduct: true } },
    },
  });

  if (existingTxs.length === 0) throw new Error('Transaksi tidak ditemukan');

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const operations: any[] = [];

  // Restore sold stock back to qtyAvailable for each item across all transactions.
  // Forward sales supplied by HQ never decremented stock, so they must not be credited
  // back either — otherwise deleting one would inflate the branch's stock.
  let restoredItems = 0;
  let skippedItems = 0;
  for (const tx of existingTxs) {
    if (!shouldDeductStock(tx.forwardSource)) {
      skippedItems += tx.items.reduce((a, i) => a + i.qty, 0);
      continue;
    }
    for (const item of tx.items) {
      restoredItems += item.qty;
      operations.push(
        prisma.branchInventory.update({
          where: {
            branchId_masterProductId: {
              branchId: tx.branchId,
              masterProductId: item.masterProductId,
            },
          },
          data: {
            qtyAvailable: { increment: item.qty },
          },
        })
      );
    }
  }

  // Delete all transactions (items cascade via onDelete: Cascade)
  operations.push(
    prisma.salesTransaction.deleteMany({
      where: { id: { in: existingTxs.map((t) => t.id) } },
    })
  );

  // Audit Log
  const totalDeleted = existingTxs.length;
  const numbers = existingTxs.map((t) => t.transactionNumber).join(', ');

  operations.push(
    prisma.auditLog.create({
      data: {
        userId: data.userId,
        userName: data.userName,
        action: 'DELETE_SALES_TRANSACTIONS',
        entity: 'SalesTransaction',
        entityId: existingTxs[0].id,
        details:
          `${data.userName} menghapus ${totalDeleted} transaksi (${numbers}). Total ${restoredItems} unit stok dikembalikan ke stok jual cabang.` +
          (skippedItems > 0
            ? ` ${skippedItems} unit dari transaksi Forward (barang dari HQ) tidak mengembalikan stok karena stok cabang tidak pernah berkurang.`
            : ''),
      },
    })
  );

  await prisma.$transaction(operations);

  // Emit real-time stock update via SSE
  sseBroadcaster.emit('SALES_UPDATED', {
    type: 'TRANSACTIONS_DELETED',
    branchId: data.branchId,
    count: totalDeleted,
    timestamp: new Date().toISOString(),
  });

  return totalDeleted;
}
