export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { setResellerSellingPrice } from '@/services/inventoryService';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { branchId, masterProductId, price, userId, userName } = body;
    if (!branchId || !masterProductId) throw new Error('branchId dan masterProductId wajib diisi');
    const inventory = await setResellerSellingPrice({ branchId, masterProductId, price: price ?? null, userId, userName });
    return NextResponse.json({ success: true, data: inventory });
  } catch (error: unknown) {
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : 'Unknown error' }, { status: 400 });
  }
}