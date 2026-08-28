export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { getBranchInventory, getAllBranchInventories } from '@/services/inventoryService';

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
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
