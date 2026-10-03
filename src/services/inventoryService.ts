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

export async function setResellerSellingPrice(data: {
  branchId: string;
  masterProductId: string;
  price: number | null;
  userId: string;
  userName: string;
}): Promise<BranchInventory> {
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

  // A blank or whitespace-only price means "no reseller price" (fall back to the offline price),
  // NOT zero. `Number('')` is 0, which passes both `isFinite` and `>= 0`, so an empty field
  // silently priced the product at Rp 0 across the public catalog, POS and belanja checkout.
  const rawPrice: unknown = data.price;
  const isBlank = rawPrice === null || rawPrice === undefined || (typeof rawPrice === 'string' && rawPrice.trim() === '');
  const price = isBlank ? null : Number(rawPrice);
  if (price !== null && (!Number.isFinite(price) || price < 0)) {
    throw new Error('Harga reseller harus berupa angka >= 0');
  }

  const updated = await prisma.branchInventory.update({
    where: { id: inventory.id },
    data: { resellerSellingPrice: price },
    include: { masterProduct: true, branch: true },
  });

  // Audit Log written in the same transaction as the price change. Previously it ran after the
  // update had already committed, so a failure here returned "gagal" for a change that had in fact
  // been saved — the operator reloaded and saw the new price, with no audit trail explaining it.
  await prisma.$transaction([
    prisma.auditLog.create({
      data: {
        userId: data.userId,
        userName: data.userName,
        action: price === null ? 'CLEAR_RESELLER_PRICE' : 'SET_RESELLER_PRICE',
        entity: 'BranchInventory',
        entityId: inventory.id,
        details:
          price === null
            ? `${data.userName} menghapus harga reseller ${inventory.masterProduct.name} (${inventory.masterProduct.sku}) di ${inventory.branch.name} (kembali ke harga Offline)`
            : `${data.userName} mengatur harga reseller ${inventory.masterProduct.name} (${inventory.masterProduct.sku}) di ${inventory.branch.name} menjadi Rp ${price}`,
      },
    }),
  ]);

  return updated as unknown as BranchInventory;
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

  // Interactive transaction so the damaged-goods guard can abort. The old code checked
  // `qty > qtyDamaged` on a read taken OUTSIDE the transaction and then wrote an unguarded
  // decrement, so two concurrent recoveries both passed the check and left `qtyDamaged`
  // negative while `qtyAvailable` absorbed both increments — recovering more units than existed.
  const results = await prisma.$transaction(async (tx) => {
    const claimed = await tx.branchInventory.updateMany({
      where: {
        id: inventory.id,
        qtyDamaged: { gte: data.qty },
      },
      data: {
        qtyDamaged: { decrement: data.qty },
        qtyAvailable: { increment: data.qty },
      },
    });

    if (claimed.count !== 1) {
      const current = await tx.branchInventory.findUnique({
        where: { id: inventory.id },
        select: { qtyDamaged: true },
      });
      throw new Error(
        `Jumlah rusak/hilang tidak mencukupi (Rusak: ${current?.qtyDamaged ?? 0}, Diminta: ${data.qty})`
      );
    }

    await tx.auditLog.create({
      data: {
        userId: data.userId,
        userName: data.userName,
        action: 'RECOVER_DAMAGED_INVENTORY',
        entity: 'BranchInventory',
        entityId: inventory.id,
        details: `${data.userName} mengembalikan ${data.qty} unit ${inventory.masterProduct.name} (${inventory.masterProduct.sku}) dari rusak/hilang ke stok jual di ${inventory.branch.name}`,
      },
    });

    return tx.branchInventory.findUnique({
      where: { id: inventory.id },
      include: { masterProduct: true, branch: true },
    });
  });

  const updatedInventory = results;

  sseBroadcaster.emit('INVENTORY_UPDATED', {
    type: 'INVENTORY_DAMAGE_RECOVERED',
    branchId: data.branchId,
    masterProductId: data.masterProductId,
    timestamp: new Date().toISOString(),
  });

  return updatedInventory as unknown as BranchInventory;
}
