import { prisma } from '@/lib/prisma';
import { sseBroadcaster } from '@/lib/sseEmitter';
import { BranchInventory } from '@/types';

export async function getBranchInventory(branchId: string): Promise<BranchInventory[]> {
  const inventories = await prisma.branchInventory.findMany({
    where: { branchId },
    include: {
      masterProduct: true,
    },
    orderBy: { masterProduct: { sku: 'asc' } },
  });
  return inventories as unknown as BranchInventory[];
}

export async function getAllBranchInventories(): Promise<BranchInventory[]> {
  const inventories = await prisma.branchInventory.findMany({
    include: {
      branch: true,
      masterProduct: true,
    },
    orderBy: [{ branch: { code: 'asc' } }, { masterProduct: { sku: 'asc' } }],
  });
  return inventories as unknown as BranchInventory[];
}

export async function recoverDamagedInventory(data: {
  branchId: string;
  masterProductId: string;
  qty: number;
  userId: string;
  userName: string;
}): Promise<BranchInventory> {
  if (!Number.isInteger(data.qty) || data.qty <= 0) {
    throw new Error('Jumlah barang yang dikembalikan harus lebih dari 0');
  }

  const inventory = await prisma.branchInventory.findUnique({
    where: {
      branchId_masterProductId: {
        branchId: data.branchId,
        masterProductId: data.masterProductId,
      },
    },
    include: { masterProduct: true, branch: true },
  });

  if (!inventory) {
    throw new Error('Stok produk tidak ditemukan di cabang ini');
  }

  if (data.qty > inventory.qtyDamaged) {
    throw new Error(
      `Jumlah rusak/hilang tidak mencukupi (Rusak: ${inventory.qtyDamaged}, Diminta: ${data.qty})`
    );
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const operations: any[] = [
    prisma.branchInventory.update({
      where: { id: inventory.id },
      data: {
        qtyDamaged: { decrement: data.qty },
        qtyAvailable: { increment: data.qty },
      },
      include: {
        masterProduct: true,
        branch: true,
      },
    }),
    prisma.auditLog.create({
      data: {
        userId: data.userId,
        userName: data.userName,
        action: 'RECOVER_DAMAGED_INVENTORY',
        entity: 'BranchInventory',
        entityId: inventory.id,
        details: `${data.userName} mengembalikan ${data.qty} unit ${inventory.masterProduct.name} (${inventory.masterProduct.sku}) dari rusak/hilang ke stok jual di ${inventory.branch.name}`,
      },
    }),
  ];

  const results = await prisma.$transaction(operations);
  const updatedInventory = results[0];

  sseBroadcaster.emit('INVENTORY_UPDATED', {
    type: 'INVENTORY_DAMAGE_RECOVERED',
    branchId: data.branchId,
    masterProductId: data.masterProductId,
    timestamp: new Date().toISOString(),
  });

  return updatedInventory as unknown as BranchInventory;
}
