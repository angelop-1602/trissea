import { NextRequest } from 'next/server';
import { z } from 'zod';
import { AUDIT_MODULES, createSuperadminTenantActionLogs } from '@/lib/audit-log';
import { bookingError, bookingErrorResponse, bookingSuccess, getRequestIdFromHeaders } from '@/lib/booking/http';
import { updateTenantWorkspaceTerminal } from '@/lib/dashboard/tenant-workspace';
import { getPrisma } from '@/lib/prisma';
import { requireSuperadmin } from '@/lib/superadmin-access';

interface Params {
  params: Promise<{ tenantId: string; terminalId: string }>;
}

const updateTerminalSchema = z
  .object({
    name: z.string().trim().min(2).max(120).optional(),
    location: z.string().trim().min(2).max(200).optional(),
    capacity: z.number().int().min(1).max(500).optional(),
    latitude: z.number().min(-90).max(90).optional(),
    longitude: z.number().min(-180).max(180).optional(),
    reason: z.string().trim().min(5).max(500),
  })
  .refine(
    (value) =>
      value.name !== undefined ||
      value.location !== undefined ||
      value.capacity !== undefined ||
      value.latitude !== undefined ||
      value.longitude !== undefined,
    {
      message: 'At least one field is required for update.',
    }
  );

export async function PATCH(request: NextRequest, { params }: Params) {
  const requestId = getRequestIdFromHeaders(request.headers);

  try {
    const user = await requireSuperadmin(request);
    const { tenantId, terminalId } = await params;
    const json = await request.json().catch(() => null);
    const parsed = updateTerminalSchema.safeParse(json);

    if (!parsed.success) {
      return bookingError(requestId, 'Invalid request body.', 400, 'INVALID_REQUEST');
    }

    const prisma = getPrisma();
    const result = await updateTenantWorkspaceTerminal({
      prisma,
      tenantId,
      terminalId,
      input: {
        name: parsed.data.name,
        location: parsed.data.location,
        capacity: parsed.data.capacity,
        latitude: parsed.data.latitude,
        longitude: parsed.data.longitude,
      },
    });

    await createSuperadminTenantActionLogs({
      prisma,
      tenantId,
      superAdminUserId: user.id,
      module: AUDIT_MODULES.todas,
      action: 'toda.updated',
      targetType: 'toda_terminal',
      targetId: terminalId,
      reason: parsed.data.reason,
      accessType: 'toda_support',
      before: result.before,
      after: result.after,
    });

    return bookingSuccess(requestId, { terminal: result.terminal });
  } catch (error) {
    return bookingErrorResponse(error, requestId);
  }
}
