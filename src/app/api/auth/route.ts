import { NextResponse } from 'next/server';
import { getAllUsers, getAllBranches } from '@/services/authService';

export async function GET() {
  try {
    const users = await getAllUsers();
    const branches = await getAllBranches();
    return NextResponse.json({ success: true, data: { users, branches } });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
