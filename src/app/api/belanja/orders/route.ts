export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { createBelanjaOrder } from '@/services/belanjaService';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const order = await createBelanjaOrder(body);
    return NextResponse.json({ success: true, data: order });
  } catch (error: unknown) {
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : 'Unknown error' }, { status: 400 });
  }
}