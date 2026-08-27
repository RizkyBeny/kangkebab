import { NextResponse } from 'next/server';
import { getShipments, createShipment, confirmShipmentReception, updateShipment } from '@/services/shipmentService';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const branchId = searchParams.get('branchId') || undefined;

    const shipments = await getShipments(branchId);
    return NextResponse.json({ success: true, data: shipments });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const shipment = await createShipment(body);
    return NextResponse.json({ success: true, data: shipment });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 400 });
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const { shipmentId, itemsConfirmed, userId, userName } = body;
    const shipment = await confirmShipmentReception(shipmentId, itemsConfirmed, userId, userName);
    return NextResponse.json({ success: true, data: shipment });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 400 });
  }
}

export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    const { shipmentId, items, userId, userName } = body;
    const shipment = await updateShipment(shipmentId, { items, userId, userName });
    return NextResponse.json({ success: true, data: shipment });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 400 });
  }
}
