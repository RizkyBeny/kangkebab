export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { getMasterProducts, createMasterProduct, updateMasterProduct, deleteMasterProduct } from '@/services/productService';

export async function GET() {
  try {
    const products = await getMasterProducts();
    return NextResponse.json({ success: true, data: products });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const product = await createMasterProduct(body);
    return NextResponse.json({ success: true, data: product });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 400 });
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const { id, ...data } = body;
    const product = await updateMasterProduct(id, data);
    return NextResponse.json({ success: true, data: product });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 400 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    const userId = searchParams.get('userId') || 'system';
    const userName = searchParams.get('userName') || 'System';

    if (!id) return NextResponse.json({ success: false, error: 'Product ID required' }, { status: 400 });

    await deleteMasterProduct(id, userId, userName);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
