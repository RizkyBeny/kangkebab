export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { getBranchInventory, getAllBranchInventories, recoverDamagedInventory } from '@/services/inventoryService';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const branchId = searchParams.get('branchId');

    if (branchId) {
      const inventory = await getBranchInventory(branchId);
      return NextResponse.json({ success: true, data: inventory });
    } else {
      const inventories = await getAllBranchInventories();
      return NextResponse.json({ success: true, data: inventories });
    }
  } catch (error: unknown) {
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : 'Unknown error' }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    const { branchId, masterProductId, qty, userId, userName } = body;
    if (!branchId || !masterProductId) throw new Error('branchId dan masterProductId wajib diisi');
    const inventory = await recoverDamagedInventory({ branchId, masterProductId, qty, userId, userName });
    return NextResponse.json({ success: true, data: inventory });
  } catch (error: unknown) {
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : 'Unknown error' }, { status: 400 });
  }
}
