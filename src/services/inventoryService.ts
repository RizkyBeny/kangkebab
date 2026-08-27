import { prisma } from '@/lib/prisma';
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
