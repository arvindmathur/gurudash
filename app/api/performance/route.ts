import { NextResponse } from 'next/server';
import { fetchFromBridge } from '@/lib/lenovo-api';

export async function GET() {
  try {
    const data = await fetchFromBridge('/performance');
    return NextResponse.json(data);
  } catch {
    return NextResponse.json(
      { available: false, reason: 'bridge_unreachable' },
      { status: 503 }
    );
  }
}
