import { NextRequest } from 'next/server';
import { bookingErrorResponse, bookingSuccess, getRequestIdFromHeaders } from '@/lib/booking/http';
import { listPlatformAuditData } from '@/lib/dashboard/platform-control';
import { getPrisma } from '@/lib/prisma';
import { requireSuperadmin } from '@/lib/superadmin-access';

export async function GET(request: NextRequest) {
  const requestId = getRequestIdFromHeaders(request.headers);

  try {
    await requireSuperadmin(request);
    const { searchParams } = new URL(request.url);
    const prisma = getPrisma();
    const data = await listPlatformAuditData(prisma, {
      tenantId: searchParams.get('tenantId')?.trim() || undefined,
      module: searchParams.get('module')?.trim() || undefined,
      action: searchParams.get('action')?.trim() || undefined,
    });

    return bookingSuccess(requestId, data);
  } catch (error) {
    return bookingErrorResponse(error, requestId);
  }
}
