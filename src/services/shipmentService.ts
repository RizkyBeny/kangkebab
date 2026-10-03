import { prisma } from '@/lib/prisma';
import { sseBroadcaster } from '@/lib/sseEmitter';
import { Shipment } from '@/types';
import { formatShortDate } from '@/constants';

function isUniqueConstraintError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    (error as { code?: string }).code === 'P2002'
  );
}

// Atomically reserve the next shipment sequence for a branch on a given date (YYYYMMDD).
// Uses its own "SHIP" counter namespace so it never collides with the INV or BLJ sequences, and
// seeds from the existing MAX suffix so numbering survives deletions. A single
// INSERT ... ON CONFLICT DO UPDATE claims a distinct number under a row lock, so concurrent
// dispatches never collide.
async function getNextShipmentSequence(branchId: string, branchCode: string, date: string): Promise<number> {
  const rows: { seq: number }[] = await prisma.$queryRaw`
    WITH existing_max AS (
      SELECT COALESCE(MAX(NULLIF(SPLIT_PART("shipmentNumber", '-', 4), '')::int), 0) AS mx
      FROM "Shipment"
      WHERE "branchId" = ${branchId}
        AND "shipmentNumber" LIKE ${`SHIP-${branchCode}-${date}-%`}
        AND SPLIT_PART("shipmentNumber", '-', 4) ~ '^[0-9]+$'
    )
    INSERT INTO "TransactionCounter" ("id", "branchId", "date", "kind", "lastNumber")
    SELECT gen_random_uuid(), ${branchId}, ${date}, 'SHIP', mx + 1
    FROM existing_max
    ON CONFLICT ("branchId", "date", "kind")
    DO UPDATE SET "lastNumber" = "TransactionCounter"."lastNumber" + 1
    RETURNING "lastNumber" AS "seq"
  `;
  return Number(rows[0].seq);
}

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

  if (!Array.isArray(data.items) || data.items.length === 0) {
    throw new Error('Pengiriman harus memuat minimal satu barang');
  }
  for (const item of data.items) {
    if (!Number.isInteger(item.qtySent) || item.qtySent <= 0) {
      throw new Error('Jumlah barang yang dikirim harus bilangan bulat lebih dari 0');
    }
    if (!Number.isFinite(item.costPrice) || item.costPrice < 0) {
      throw new Error('Modal barang harus berupa angka >= 0');
    }
  }

  const todayStr = formatShortDate(new Date());

  // Retry on a unique-constraint collision. The sequence is reserved atomically, but two requests
  // racing on the same counter can still both be handed the same number once the earlier one
  // commits — and this path previously had no retry, so the loser surfaced a raw "Unique
  // constraint failed" and the shipment was never recorded at all.
  const MAX_ATTEMPTS = 3;
  let lastError: unknown;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      // Reserved through the same TransactionCounter machinery as the invoice and belanja numbers.
      // This used to be a plain `count() + 1` read-then-write against a @unique column, and being
      // global rather than per-branch it also produced gaps as branches took turns.
      const seq = await getNextShipmentSequence(branch.id, branch.code, todayStr);
      const shipmentNumber = `SHIP-${branch.code}-${todayStr}-${String(seq).padStart(3, '0')}`;

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

      // Audit Log — inside the transaction that creates the shipment, so a failure here can no
      // longer report "gagal" for a dispatch that was already recorded.
      await prisma.$transaction([
        prisma.auditLog.create({
          data: {
            userId: data.userId,
            userName: data.userName,
            action: 'CREATE_SHIPMENT',
            entity: 'Shipment',
            entityId: createdShipment.id,
            details: `Mengirim pengiriman ${shipmentNumber} (${data.items.length} jenis produk) ke ${branch.name}`,
          },
        }),
      ]);

      // Realtime Push SSE Broadcast event
      sseBroadcaster.emit('SHIPMENT_UPDATED', {
        type: 'SHIPMENT_CREATED',
        branchId: data.branchId,
        shipmentId: createdShipment.id,
        shipmentNumber,
        timestamp: new Date().toISOString(),
      });

      return createdShipment as unknown as Shipment;
    } catch (error) {
      lastError = error;
      if (isUniqueConstraintError(error) && attempt < MAX_ATTEMPTS) continue;
      throw error;
    }
  }
  throw lastError;
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

  // A reception must account for EVERY line. Previously unknown ids were skipped with
  // `continue`, so an empty or partial `itemsConfirmed` still flipped the shipment to DITERIMA
  // and closed it forever while crediting (part of) nothing — the stock silently vanished with no
  // way to re-receive it.
  if (!Array.isArray(itemsConfirmed) || itemsConfirmed.length === 0) {
    throw new Error('Konfirmasi penerimaan harus memuat minimal satu item');
  }
  if (itemsConfirmed.length !== shipment.items.length) {
    throw new Error(
      `Konfirmasi penerimaan tidak lengkap: ${itemsConfirmed.length} dari ${shipment.items.length} item terkonfirmasi`
    );
  }

  const seen = new Set<string>();
  for (const conf of itemsConfirmed) {
    const item = shipment.items.find((i) => i.id === conf.itemId);
    if (!item) throw new Error(`Item barang ${conf.itemId} tidak ada dalam pengiriman ini`);
    if (seen.has(conf.itemId)) throw new Error(`Item barang ${conf.itemId} terkonfirmasi lebih dari sekali`);
    seen.add(conf.itemId);

    // qtyDamaged was previously unvalidated, which fabricated stock two different ways:
    // a negative value raised qtyAvailable (nothing was ever shipped), and a value above
    // qtyReceived materialised damaged units out of thin air and inflated the damage reports.
    const qtyReceived = Number(conf.qtyReceived);
    const qtyDamaged = Number(conf.qtyDamaged);
    if (!Number.isInteger(qtyReceived) || qtyReceived < 0) {
      throw new Error(`Jumlah diterima untuk ${item.masterProductId} harus bilangan bulat >= 0`);
    }
    if (!Number.isInteger(qtyDamaged) || qtyDamaged < 0) {
      throw new Error(`Jumlah rusak untuk ${item.masterProductId} harus bilangan bulat >= 0`);
    }
    if (qtyDamaged > qtyReceived) {
      throw new Error(
        `Jumlah rusak tidak boleh lebih besar dari jumlah diterima untuk ${item.masterProductId} (${qtyDamaged} > ${qtyReceived})`
      );
    }
    if (qtyReceived > item.qtySent) {
      throw new Error(
        `Jumlah diterima untuk ${item.masterProductId} tidak boleh melebihi jumlah yang dikirim (${qtyReceived} > ${item.qtySent})`
      );
    }
  }

  // Interactive transaction so the status transition can GATE the credit. The old code read
  // `status` here, outside the transaction, and then wrote `status: 'DITERIMA'` with no predicate
  // on it — so two simultaneous confirmations both read DIKIRIM and both ran the inventory
  // upsert, crediting the branch's stock twice.
  const updatedShipment = await prisma.$transaction(async (tx) => {
    // Claim the transition first. `status: 'DIKIRIM'` makes this an atomic compare-and-set: the
    // loser of a race matches 0 rows and rolls back before any stock is credited.
    const claimed = await tx.shipment.updateMany({
      where: { id: shipmentId, status: 'DIKIRIM' },
      data: { status: 'DITERIMA', receivedAt: new Date() },
    });
    if (claimed.count !== 1) {
      throw new Error('Pengiriman ini sudah divalidasi sebelumnya');
    }

    // Accumulate from the items we actually wrote, so the audit text can never disagree with the
    // inventory (it used to total `itemsConfirmed`, including rows that had been skipped).
    let totalDamaged = 0;

    for (const conf of itemsConfirmed) {
      const item = shipment.items.find((i) => i.id === conf.itemId)!;
      const qtyReceived = Number(conf.qtyReceived);
      const qtyDamaged = Number(conf.qtyDamaged);
      const qtyGood = Math.max(0, qtyReceived - qtyDamaged);
      totalDamaged += qtyDamaged;

      await tx.shipmentItem.update({
        where: { id: conf.itemId },
        data: { qtyReceived, qtyDamaged },
      });

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
          qtyDamaged,
        },
        update: {
          qtyAvailable: { increment: qtyGood },
          qtyDamaged: { increment: qtyDamaged },
        },
      });
    }

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

    return tx.shipment.findUnique({
      where: { id: shipmentId },
      include: {
        branch: true,
        items: { include: { masterProduct: true } },
      },
    });
  });

  // Realtime SSE Broadcast event
  sseBroadcaster.emit('SHIPMENT_UPDATED', {
    type: 'SHIPMENT_RECEIVED',
    branchId: shipment.branchId,
    shipmentId,
    timestamp: new Date().toISOString(),
  });

  return updatedShipment as unknown as Shipment;
}

export async function updateShipment(
  shipmentId: string,
  data: {
    items: { masterProductId: string; qtySent: number; costPrice: number }[];
    userId: string;
    userName: string;
  }
): Promise<Shipment> {
  const shipment = await prisma.shipment.findUnique({
    where: { id: shipmentId },
    include: { branch: true },
  });

  if (!shipment) throw new Error('Pengiriman tidak ditemukan');
  if (shipment.status !== 'DIKIRIM') throw new Error('Hanya pengiriman berstatus Menunggu Cabang yang dapat diubah');

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const operations: any[] = [];

  // Delete all existing items
  operations.push(prisma.shipmentItem.deleteMany({ where: { shipmentId } }));

  // Re-create items with the new data
  operations.push(
    prisma.shipment.update({
      where: { id: shipmentId },
      data: {
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
    })
  );

  // Audit log
  operations.push(
    prisma.auditLog.create({
      data: {
        userId: data.userId,
        userName: data.userName,
        action: 'UPDATE_SHIPMENT',
        entity: 'Shipment',
        entityId: shipmentId,
        details: `Mengubah rincian pengiriman ${shipment.shipmentNumber} ke ${shipment.branch.name}`,
      },
    })
  );

  const results = await prisma.$transaction(operations);
  const updatedShipment = results[1]; // The update query

  sseBroadcaster.emit('SHIPMENT_UPDATED', {
    type: 'SHIPMENT_EDITED',
    branchId: shipment.branchId,
    shipmentId,
    timestamp: new Date().toISOString(),
  });

  return updatedShipment as unknown as Shipment;
}
