import { NextRequest } from 'next/server';
import { bookingErrorResponse, bookingSuccess, getRequestIdFromHeaders } from '@/lib/booking/http';
import { getTenantWorkspaceAuditData } from '@/lib/dashboard/tenant-workspace';
import { getPrisma } from '@/lib/prisma';
import { requireSuperadmin } from '@/lib/superadmin-access';

interface Params {
  params: Promise<{ tenantId: string }>;
}

export async function GET(request: NextRequest, { params }: Params) {
  const requestId = getRequestIdFromHeaders(request.headers);

  try {
    await requireSuperadmin(request);
    const { tenantId } = await params;
    const { searchParams } = new URL(request.url);
    const prisma = getPrisma();
    const data = await getTenantWorkspaceAuditData(prisma, tenantId, {
      module: searchParams.get('module')?.trim() || undefined,
      action: searchParams.get('action')?.trim() || undefined,
      from: searchParams.get('from')?.trim() || undefined,
      to: searchParams.get('to')?.trim() || undefined,
    });

    return bookingSuccess(requestId, data);
  } catch (error) {
    return bookingErrorResponse(error, requestId);
  }
}
