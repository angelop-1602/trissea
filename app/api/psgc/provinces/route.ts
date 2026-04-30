import { NextRequest, NextResponse } from 'next/server';
import { searchPSGCProvinces } from '@/lib/psgc';

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get('q')?.trim() ?? '';

  try {
    const provinces = await searchPSGCProvinces(query);
    return NextResponse.json({ provinces });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to fetch province list.';
    return NextResponse.json(
      {
        error: message,
      },
      { status: 502 }
    );
  }
}
