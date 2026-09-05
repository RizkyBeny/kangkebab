import { prisma } from '@/lib/prisma';
import { sseBroadcaster } from '@/lib/sseEmitter';
import { SalesTransaction, SalesChannel, OnlinePlatform } from '@/types';
import { formatShortDate } from '@/constants';

export async function createSalesTransaction(data: {
  branchId: string;
  channel: SalesChannel;
  platform?: OnlinePlatform | null;
  items: { masterProductId: string; qty: number; customPrice?: number }[];
  userId: string;
  userName: string;
  customerName: string;
  customerPhone: string;
  paymentStatus: string;
  paymentMethod: string;
  ecommerceActualPrice?: number | null;
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

  const branch = await prisma.branch.findUnique({ where: { id: data.branchId } });
  if (!branch) throw new Error('Cabang tidak ditemukan');

  // Calculate invoice number: INV/CBG01/20260827/0001
  const todayStr = formatShortDate(new Date());
  const countToday = await prisma.salesTransaction.count({
    where: {
      branchId: data.branchId,
      createdAt: {
        gte: new Date(new Date().setHours(0, 0, 0, 0)),
      },
    },
  });

  const transactionNumber = `INV/${branch.code}/${todayStr}/${String(countToday + 1).padStart(4, '0')}`;

  let grandTotalAmount = 0;
  let grandTotalCost = 0;
  const transactionItemsData: { masterProductId: string; qty: number; sellingPrice: number; costPrice: number }[] = [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const operations: any[] = [];

  // Validate inventory & calculate totals atomically outside the main transaction array (using individual reads)
  // This avoids Interactive Transaction limits on Supabase PgBouncer
  for (const cartItem of data.items) {
    const inventory = await prisma.branchInventory.findUnique({
      where: {
        branchId_masterProductId: {
          branchId: data.branchId,
          masterProductId: cartItem.masterProductId,
        },
      },
      include: { masterProduct: true },
    });

    if (!inventory || inventory.qtyAvailable < cartItem.qty) {
      const prodName = inventory?.masterProduct.name || 'Produk';
      throw new Error(`Stok ${prodName} tidak mencukupi (Tersedia: ${inventory?.qtyAvailable || 0}, Diminta: ${cartItem.qty})`);
    }

    const prod = inventory.masterProduct;
    // Auto-lock price based on channel & platform, or override with custom price if provided
    const autoPrice =
      data.channel === 'ONLINE'
        ? data.platform === 'SHOPEE'
          ? prod.shopeeSellingPrice
          : prod.tiktokSellingPrice
        : prod.offlineSellingPrice;
    const sellingPrice = data.items.find(i => i.masterProductId === cartItem.masterProductId)?.customPrice ?? autoPrice;
    const itemSubtotal = sellingPrice * cartItem.qty;
    const itemCostTotal = prod.costPrice * cartItem.qty;

    grandTotalAmount += itemSubtotal;
    grandTotalCost += itemCostTotal;

    transactionItemsData.push({
      masterProductId: cartItem.masterProductId,
      qty: cartItem.qty,
      sellingPrice,
      costPrice: prod.costPrice,
    });

    // Atomically decrement stock
    operations.push(
      prisma.branchInventory.update({
        where: { id: inventory.id },
        data: {
          qtyAvailable: { decrement: cartItem.qty },
        },
      })
    );
  }

  // For ONLINE transactions, the ecommerce actual price IS the primary amount (overrides computed total)
  const finalTotalAmount =
    data.channel === 'ONLINE' ? (data.ecommerceActualPrice ?? grandTotalAmount) : grandTotalAmount;

  // Create SalesTransaction record
  operations.push(
    prisma.salesTransaction.create({
      data: {
        transactionNumber,
        branchId: data.branchId,
        channel: data.channel,
        platform: data.channel === 'ONLINE' ? data.platform : 'NONE',
        customerName: data.customerName,
        customerPhone: data.customerPhone,
        paymentStatus: data.paymentStatus,
        paymentMethod: data.paymentMethod,
        ecommerceActualPrice: data.channel === 'ONLINE' ? data.ecommerceActualPrice : null,
        totalAmount: finalTotalAmount,
        totalCost: grandTotalCost,
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
    })
  );

  // Audit Log
  operations.push(
    prisma.auditLog.create({
      data: {
        userId: data.userId,
        userName: data.userName,
        action: 'CREATE_SALES_TRANSACTION',
        entity: 'SalesTransaction',
        // entityId will be set after execution, but for Sequential Transactions we can't easily chain IDs.
        // We will leave entityId blank or generate a UUID beforehand if needed.
        // For simplicity, we just save the transaction number.
        details: `Transaksi ${transactionNumber} (${data.channel}${data.platform ? ' - ' + data.platform : ''}) diselesaikan di ${branch.name}. Total: Rp ${finalTotalAmount}`,
      },
    })
  );

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

  if (filters?.startDate || filters?.endDate) {
    whereCondition.createdAt = {};
    if (filters.startDate) {
      whereCondition.createdAt.gte = new Date(filters.startDate);
    }
    if (filters.endDate) {
      const end = new Date(filters.endDate);
      end.setUTCHours(23, 59, 59, 999);
      whereCondition.createdAt.lte = end;
    }
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
    orderBy: { createdAt: 'desc' },
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
  }
): Promise<SalesTransaction> {
  const existingTx = await prisma.salesTransaction.findUnique({
    where: { id },
    include: { items: true },
  });

  if (!existingTx) throw new Error('Transaksi tidak ditemukan');

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const operations: any[] = [];
  let newTotalAmount = existingTx.totalAmount;

  if (data.items && data.items.length > 0) {
    // We update each item's qty and sellingPrice.
    // NOTE: If qty changes, we should ideally adjust inventory, but since this is history editing,
    // we assume the user only fixes mistakes or edits prices.
    // For simplicity, we just update the transaction item values and recalculate totals.
    let calcTotalAmount = 0;
    
    for (const item of data.items) {
      const existingItem = existingTx.items.find(i => i.id === item.id);
      if (existingItem) {
        calcTotalAmount += item.qty * item.sellingPrice;
        
        operations.push(
          prisma.salesTransactionItem.update({
            where: { id: item.id },
            data: {
              qty: item.qty,
              sellingPrice: item.sellingPrice,
            }
          })
        );
      }
    }
    newTotalAmount = calcTotalAmount;
  }

  // If ecommerceActualPrice is provided, it completely overrides the totalAmount
  if (data.ecommerceActualPrice !== undefined && data.ecommerceActualPrice !== null) {
    newTotalAmount = data.ecommerceActualPrice;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const updateData: any = {
    totalAmount: newTotalAmount,
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

  // Restore sold stock back to qtyAvailable for each item across all transactions
  for (const tx of existingTxs) {
    for (const item of tx.items) {
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
  const totalItemsRestored = existingTxs.reduce(
    (acc, tx) => acc + tx.items.reduce((a, i) => a + i.qty, 0),
    0
  );
  const numbers = existingTxs.map((t) => t.transactionNumber).join(', ');

  operations.push(
    prisma.auditLog.create({
      data: {
        userId: data.userId,
        userName: data.userName,
        action: 'DELETE_SALES_TRANSACTIONS',
        entity: 'SalesTransaction',
        entityId: existingTxs[0].id,
        details: `${data.userName} menghapus ${totalDeleted} transaksi (${numbers}). Total ${totalItemsRestored} unit stok dikembalikan ke stok jual.`,
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
