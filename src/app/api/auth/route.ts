import { NextResponse } from 'next/server';
import { getAllUsers, getAllBranches } from '@/services/authService';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const users = await getAllUsers();
    const branches = await getAllBranches();
    return NextResponse.json({ success: true, data: { users, branches } });
  } catch (error: any) {
    console.error("Auth API Error:", error);
    return NextResponse.json({ success: false, error: error.message || String(error) }, { status: 500 });
  }
}
