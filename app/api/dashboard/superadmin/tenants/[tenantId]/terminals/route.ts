import { NextRequest } from 'next/server';
import { z } from 'zod';
import { AUDIT_MODULES, createSuperadminTenantActionLogs } from '@/lib/audit-log';
import { bookingError, bookingErrorResponse, bookingSuccess, getRequestIdFromHeaders } from '@/lib/booking/http';
import { createTenantWorkspaceTerminal, getTenantWorkspaceTerminalsData } from '@/lib/dashboard/tenant-workspace';
import { getPrisma } from '@/lib/prisma';
import { requireSuperadmin } from '@/lib/superadmin-access';

interface Params {
  params: Promise<{ tenantId: string }>;
}

const createTerminalSchema = z.object({
  name: z.string().trim().min(2).max(120),
  location: z.string().trim().min(2).max(200),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  reason: z.string().trim().min(5).max(500),
});

export async function GET(request: NextRequest, { params }: Params) {
  const requestId = getRequestIdFromHeaders(request.headers);

  try {
    await requireSuperadmin(request);
    const { tenantId } = await params;
    const prisma = getPrisma();
    const data = await getTenantWorkspaceTerminalsData(prisma, tenantId);

    return bookingSuccess(requestId, data);
  } catch (error) {
    return bookingErrorResponse(error, requestId);
  }
}

export async function POST(request: NextRequest, { params }: Params) {
  const requestId = getRequestIdFromHeaders(request.headers);

  try {
    const user = await requireSuperadmin(request);
    const { tenantId } = await params;
    const json = await request.json().catch(() => null);
    const parsed = createTerminalSchema.safeParse(json);

    if (!parsed.success) {
      return bookingError(requestId, 'Invalid request body.', 400, 'INVALID_REQUEST');
    }

    const prisma = getPrisma();
    const result = await createTenantWorkspaceTerminal({
      prisma,
      tenantId,
      input: {
        name: parsed.data.name,
        location: parsed.data.location,
        latitude: parsed.data.latitude,
        longitude: parsed.data.longitude,
      },
    });

    await createSuperadminTenantActionLogs({
      prisma,
      tenantId,
      superAdminUserId: user.id,
      module: AUDIT_MODULES.todas,
      action: 'toda.created',
      targetType: 'toda_terminal',
      targetId: result.terminal.id,
      reason: parsed.data.reason,
      accessType: 'toda_support',
      after: {
        name: result.terminal.name,
        location: result.terminal.location,
        capacity: result.terminal.capacity,
      },
    });

    return bookingSuccess(requestId, { terminal: result.terminal }, { status: 201 });
  } catch (error) {
    return bookingErrorResponse(error, requestId);
  }
}
