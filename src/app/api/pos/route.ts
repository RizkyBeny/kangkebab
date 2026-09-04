export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { SalesChannel } from '@/types';
import { getSalesTransactions, createSalesTransaction, updateSalesTransaction, deleteSalesTransaction, deleteSalesTransactions } from '@/services/posService';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const branchId = searchParams.get('branchId') || undefined;
    const channel = (searchParams.get('channel') as SalesChannel) || undefined;
    const startDate = searchParams.get('startDate') || undefined;
    const endDate = searchParams.get('endDate') || undefined;

    const transactions = await getSalesTransactions({ branchId, channel, startDate, endDate });
    return NextResponse.json({ success: true, data: transactions });
  } catch (error: unknown) {
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : 'Unknown error' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const transaction = await createSalesTransaction(body);
    return NextResponse.json({ success: true, data: transaction });
  } catch (error: unknown) {
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : 'Unknown error' }, { status: 400 });
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const { id, ...updateData } = body;
    if (!id) throw new Error('Transaction ID is required');
    const transaction = await updateSalesTransaction(id, updateData);
    return NextResponse.json({ success: true, data: transaction });
  } catch (error: unknown) {
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : 'Unknown error' }, { status: 400 });
  }
}

export async function DELETE(request: Request) {
  try {
    const body = await request.json();
    const { id, ids, branchId, userId, userName } = body;
    if (ids && Array.isArray(ids) && ids.length > 0) {
      const count = await deleteSalesTransactions({ ids, branchId, userId, userName });
      return NextResponse.json({ success: true, deleted: count });
    }
    if (!id) throw new Error('Transaction ID is required');
    await deleteSalesTransaction({ id, branchId, userId, userName });
    return NextResponse.json({ success: true, deleted: 1 });
  } catch (error: unknown) {
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : 'Unknown error' }, { status: 400 });
  }
}
