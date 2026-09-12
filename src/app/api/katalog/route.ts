export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const branchId = searchParams.get('branchId') || undefined;

    const branches = await prisma.branch.findMany({ orderBy: { code: 'asc' } });

    let targetBranchId = branchId ?? null;
    if (!targetBranchId) {
      // Default to the branch holding the most sellable stock.
      const stockTotals = await prisma.branchInventory.groupBy({
        by: ['branchId'],
        _sum: { qtyAvailable: true },
      });
      stockTotals.sort((a, b) => (b._sum.qtyAvailable ?? 0) - (a._sum.qtyAvailable ?? 0));
      targetBranchId = stockTotals[0]?.branchId ?? branches[0]?.id ?? null;
    }

    if (!targetBranchId) {
      return NextResponse.json({ success: true, data: { branches: [], products: [], selectedBranchId: null } });
    }

    const inventories = await prisma.branchInventory.findMany({
      where: { branchId: targetBranchId, qtyAvailable: { gt: 0 } },
      include: { masterProduct: true },
      orderBy: { masterProduct: { name: 'asc' } },
    });

    const products = inventories.map((inv) => ({
      masterProductId: inv.masterProductId,
      sku: inv.masterProduct.sku,
      name: inv.masterProduct.name,
      variant: inv.masterProduct.variant,
      unitPrice: inv.resellerSellingPrice ?? inv.masterProduct.offlineSellingPrice,
      offlinePrice: inv.masterProduct.offlineSellingPrice,
      isResellerPriced:
        inv.resellerSellingPrice != null && inv.resellerSellingPrice !== inv.masterProduct.offlineSellingPrice,
      qtyAvailable: inv.qtyAvailable,
    }));

    return NextResponse.json({
      success: true,
      data: {
        branches: branches.map((b) => ({ id: b.id, code: b.code, name: b.name })),
        products,
        selectedBranchId: targetBranchId,
      },
    });
  } catch (error: unknown) {
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : 'Unknown error' }, { status: 500 });
  }
}