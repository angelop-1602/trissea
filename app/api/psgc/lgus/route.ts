import { NextRequest, NextResponse } from 'next/server';
import { searchPSGCLGUs } from '@/lib/psgc';

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get('q')?.trim() ?? '';

  try {
    const lgus = await searchPSGCLGUs(query);
    return NextResponse.json({ lgus });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to fetch LGU list.';
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
