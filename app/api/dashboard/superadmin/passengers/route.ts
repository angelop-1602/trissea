import { NextRequest } from 'next/server';
import { bookingErrorResponse, bookingSuccess, getRequestIdFromHeaders } from '@/lib/booking/http';
import { listPlatformPassengersData } from '@/lib/dashboard/platform-control';
import { getPrisma } from '@/lib/prisma';
import { requireSuperadmin } from '@/lib/superadmin-access';

export async function GET(request: NextRequest) {
  const requestId = getRequestIdFromHeaders(request.headers);

  try {
    await requireSuperadmin(request);
    const { searchParams } = new URL(request.url);
    const prisma = getPrisma();
    const data = await listPlatformPassengersData(prisma, {
      query: searchParams.get('query')?.trim() || undefined,
      tenantId: searchParams.get('tenantId')?.trim() || undefined,
      activity: (searchParams.get('activity')?.trim() as 'all' | 'active' | 'inactive' | null) ?? undefined,
    });

    return bookingSuccess(requestId, data);
  } catch (error) {
    return bookingErrorResponse(error, requestId);
  }
}
