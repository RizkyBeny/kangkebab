import { prisma } from '@/lib/prisma';
import { sseBroadcaster } from '@/lib/sseEmitter';
import { SalesTransaction, SalesChannel, OnlinePlatform } from '@/types';
import { formatShortDate } from '@/constants';

export async function createSalesTransaction(data: {
  branchId: string;
  channel: SalesChannel;
  platform?: OnlinePlatform | null;
  items: { masterProductId: string; qty: number }[];
  userId: string;
  userName: string;
}): Promise<SalesTransaction> {
  if (data.items.length === 0) {
    throw new Error('Keranjang belanja tidak boleh kosong');
  }

  if (data.channel === 'ONLINE' && (!data.platform || data.platform === 'NONE')) {
    throw new Error('Wajib memilih platform e-commerce (Shopee atau TikTok) untuk transaksi Online');
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
  const transactionItemsData: any[] = [];
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
    // Auto-lock price based on channel
    const sellingPrice = data.channel === 'ONLINE' ? prod.onlineSellingPrice : prod.offlineSellingPrice;
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

  // Create SalesTransaction record
  operations.push(
    prisma.salesTransaction.create({
      data: {
        transactionNumber,
        branchId: data.branchId,
        channel: data.channel,
        platform: data.channel === 'ONLINE' ? data.platform : 'NONE',
        totalAmount: grandTotalAmount,
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
        details: `Transaksi ${transactionNumber} (${data.channel}${data.platform ? ' - ' + data.platform : ''}) diselesaikan di ${branch.name}. Total: Rp ${grandTotalAmount}`,
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
