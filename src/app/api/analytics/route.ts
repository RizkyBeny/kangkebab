export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { getConsolidatedFinancials } from '@/services/analyticsService';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const branchId = searchParams.get('branchId') || undefined;
    const startDate = searchParams.get('startDate') || undefined;
    const endDate = searchParams.get('endDate') || undefined;

    const data = await getConsolidatedFinancials({ branchId, startDate, endDate });
    return NextResponse.json({ success: true, data });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
