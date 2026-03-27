import { NextResponse } from 'next/server';
import { fetchFromBridge } from '@/lib/lenovo-api';

export async function GET() {
  try {
    const data = await fetchFromBridge('/activity');
    return NextResponse.json(data);
  } catch {
    return NextResponse.json(
      { error: 'bridge_unreachable', lastSuccessfulFetch: null },
      { status: 503 }
    );
  }
}
