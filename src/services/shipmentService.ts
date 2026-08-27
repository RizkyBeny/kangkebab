import { prisma } from '@/lib/prisma';
import { sseBroadcaster } from '@/lib/sseEmitter';
import { Shipment } from '@/types';
import { formatShortDate } from '@/constants';

export async function getShipments(branchId?: string): Promise<Shipment[]> {
  const whereCondition = branchId ? { branchId } : {};

  const shipments = await prisma.shipment.findMany({
    where: whereCondition,
    include: {
      branch: true,
      items: {
        include: {
          masterProduct: true,
        },
      },
    },
    orderBy: { sentAt: 'desc' },
  });

  return shipments as unknown as Shipment[];
}

export async function createShipment(data: {
  branchId: string;
  items: { masterProductId: string; qtySent: number; costPrice: number }[];
  userId: string;
  userName: string;
}): Promise<Shipment> {
  const branch = await prisma.branch.findUnique({ where: { id: data.branchId } });
  if (!branch) throw new Error('Cabang tujuan tidak ditemukan');

  const todayStr = formatShortDate(new Date());
  const countToday = await prisma.shipment.count({
    where: {
      sentAt: {
        gte: new Date(new Date().setHours(0, 0, 0, 0)),
      },
    },
  });

  const shipmentNumber = `SHIP-${branch.code}-${todayStr}-${String(countToday + 1).padStart(3, '0')}`;

  const createdShipment = await prisma.shipment.create({
    data: {
      shipmentNumber,
      branchId: data.branchId,
      status: 'DIKIRIM',
      sentAt: new Date(),
      items: {
        create: data.items.map((item) => ({
          masterProductId: item.masterProductId,
          costPrice: item.costPrice,
          qtySent: item.qtySent,
          qtyReceived: 0,
          qtyDamaged: 0,
        })),
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
  });

  // Audit Log
  await prisma.auditLog.create({
    data: {
      userId: data.userId,
      userName: data.userName,
      action: 'CREATE_SHIPMENT',
      entity: 'Shipment',
      entityId: createdShipment.id,
      details: `Mengirim pengiriman ${shipmentNumber} (${data.items.length} jenis produk) ke ${branch.name}`,
    },
  });

  // Realtime Push SSE Broadcast event
  sseBroadcaster.emit('SHIPMENT_UPDATED', {
    type: 'SHIPMENT_CREATED',
    branchId: data.branchId,
    shipmentId: createdShipment.id,
    shipmentNumber,
    timestamp: new Date().toISOString(),
  });

  return createdShipment as unknown as Shipment;
}

export async function confirmShipmentReception(
  shipmentId: string,
  itemsConfirmed: { itemId: string; qtyReceived: number; qtyDamaged: number }[],
  userId: string,
  userName: string
): Promise<Shipment> {
  const shipment = await prisma.shipment.findUnique({
    where: { id: shipmentId },
    include: { branch: true, items: true },
  });

  if (!shipment) throw new Error('Pengiriman tidak ditemukan');
  if (shipment.status === 'DITERIMA') throw new Error('Pengiriman ini sudah divalidasi sebelumnya');

  return await prisma.$transaction(async (tx: any) => {
    // 1. Update items in shipment
    for (const conf of itemsConfirmed) {
      const item = shipment.items.find((i: any) => i.id === conf.itemId);
      if (!item) continue;

      const qtyGood = Math.max(0, conf.qtyReceived - conf.qtyDamaged);

      await tx.shipmentItem.update({
        where: { id: conf.itemId },
        data: {
          qtyReceived: conf.qtyReceived,
          qtyDamaged: conf.qtyDamaged,
        },
      });

      // Update Branch Inventory
      await tx.branchInventory.upsert({
        where: {
          branchId_masterProductId: {
            branchId: shipment.branchId,
            masterProductId: item.masterProductId,
          },
        },
        create: {
          branchId: shipment.branchId,
          masterProductId: item.masterProductId,
          qtyAvailable: qtyGood,
          qtyDamaged: conf.qtyDamaged,
        },
        update: {
          qtyAvailable: { increment: qtyGood },
          qtyDamaged: { increment: conf.qtyDamaged },
        },
      });
    }

    // 2. Mark shipment as DITERIMA
    const updatedShipment = await tx.shipment.update({
      where: { id: shipmentId },
      data: {
        status: 'DITERIMA',
        receivedAt: new Date(),
      },
      include: {
        branch: true,
        items: {
          include: {
            masterProduct: true,
          },
        },
      },
    });

    // 3. Audit log
    const totalDamaged = itemsConfirmed.reduce((acc, curr) => acc + curr.qtyDamaged, 0);
    await tx.auditLog.create({
      data: {
        userId,
        userName,
        action: 'CONFIRM_SHIPMENT_RECEPTION',
        entity: 'Shipment',
        entityId: shipmentId,
        details: `Cabang ${shipment.branch.name} memvalidasi penerimaan ${shipment.shipmentNumber}. Total barang rusak/kurang: ${totalDamaged} unit`,
      },
    });

    // Realtime SSE Broadcast event
    sseBroadcaster.emit('SHIPMENT_UPDATED', {
      type: 'SHIPMENT_RECEIVED',
      branchId: shipment.branchId,
      shipmentId,
      timestamp: new Date().toISOString(),
    });

    return updatedShipment as unknown as Shipment;
  });
}
