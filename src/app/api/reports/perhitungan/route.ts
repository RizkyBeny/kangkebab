export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { getPerhitunganReport } from '@/services/reportService';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const branchId = searchParams.get('branchId');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    console.log('[DEBUG API] Request params:', { branchId, startDate, endDate });

    if (!branchId) throw new Error('branchId wajib diisi');
    if (!startDate || !endDate) throw new Error('startDate dan endDate wajib diisi');

    const data = await getPerhitunganReport({ branchId, startDate, endDate });
    return NextResponse.json({ success: true, data });
  } catch (error: unknown) {
    console.error('[DEBUG API] Error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 400 }
    );
  }
}
