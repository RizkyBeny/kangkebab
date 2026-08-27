import { prisma } from '@/lib/prisma';
import { MasterProduct } from '@/types';

export async function getMasterProducts(): Promise<MasterProduct[]> {
  const products = await prisma.masterProduct.findMany({
    orderBy: { sku: 'asc' },
  });
  return products as unknown as MasterProduct[];
}

export async function createMasterProduct(data: {
  sku: string;
  name: string;
  variant: string;
  costPrice: number;
  offlineSellingPrice: number;
  onlineSellingPrice: number;
  userId: string;
  userName: string;
}): Promise<MasterProduct> {
  const product = await prisma.masterProduct.create({
    data: {
      sku: data.sku.toUpperCase(),
      name: data.name,
      variant: data.variant,
      costPrice: data.costPrice,
      offlineSellingPrice: data.offlineSellingPrice,
      onlineSellingPrice: data.onlineSellingPrice,
    },
  });

  // Audit log
  await prisma.auditLog.create({
    data: {
      userId: data.userId,
      userName: data.userName,
      action: 'CREATE_MASTER_PRODUCT',
      entity: 'MasterProduct',
      entityId: product.id,
      details: `Membuat master produk ${product.name} (${product.variant}) SKU ${product.sku}`,
    },
  });

  return product as unknown as MasterProduct;
}

export async function updateMasterProduct(
  id: string,
  data: {
    sku?: string;
    name?: string;
    variant?: string;
    costPrice?: number;
    offlineSellingPrice?: number;
    onlineSellingPrice?: number;
    userId: string;
    userName: string;
  }
): Promise<MasterProduct> {
  const oldProduct = await prisma.masterProduct.findUnique({ where: { id } });

  const updated = await prisma.masterProduct.update({
    where: { id },
    data: {
      sku: data.sku?.toUpperCase(),
      name: data.name,
      variant: data.variant,
      costPrice: data.costPrice,
      offlineSellingPrice: data.offlineSellingPrice,
      onlineSellingPrice: data.onlineSellingPrice,
    },
  });

  let changesText = `Update master produk ${updated.name}`;
  if (oldProduct && data.costPrice && oldProduct.costPrice !== data.costPrice) {
    changesText += ` | Harga modal: ${oldProduct.costPrice} -> ${data.costPrice}`;
  }
  if (oldProduct && data.offlineSellingPrice && oldProduct.offlineSellingPrice !== data.offlineSellingPrice) {
    changesText += ` | Jual Offline: ${oldProduct.offlineSellingPrice} -> ${data.offlineSellingPrice}`;
  }
  if (oldProduct && data.onlineSellingPrice && oldProduct.onlineSellingPrice !== data.onlineSellingPrice) {
    changesText += ` | Jual Online: ${oldProduct.onlineSellingPrice} -> ${data.onlineSellingPrice}`;
  }

  await prisma.auditLog.create({
    data: {
      userId: data.userId,
      userName: data.userName,
      action: 'UPDATE_MASTER_PRODUCT',
      entity: 'MasterProduct',
      entityId: id,
      details: changesText,
    },
  });

  return updated as unknown as MasterProduct;
}

export async function deleteMasterProduct(id: string, userId: string, userName: string): Promise<void> {
  const prod = await prisma.masterProduct.findUnique({ where: { id } });
  await prisma.masterProduct.delete({ where: { id } });

  await prisma.auditLog.create({
    data: {
      userId,
      userName,
      action: 'DELETE_MASTER_PRODUCT',
      entity: 'MasterProduct',
      entityId: id,
      details: `Menghapus master produk ${prod?.name || id}`,
    },
  });
}
