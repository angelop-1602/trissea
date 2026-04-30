import { NextRequest } from 'next/server';
import { z } from 'zod';
import { AUDIT_MODULES, createSuperadminTenantActionLogs } from '@/lib/audit-log';
import { bookingError, bookingErrorResponse, bookingSuccess, getRequestIdFromHeaders } from '@/lib/booking/http';
import { updateTenantWorkspaceDriverRestriction } from '@/lib/dashboard/tenant-workspace';
import { getPrisma } from '@/lib/prisma';
import { requireSuperadmin } from '@/lib/superadmin-access';

interface Params {
  params: Promise<{ tenantId: string; driverId: string }>;
}

const updateRestrictionSchema = z.object({
  isDriverRestricted: z.boolean(),
  reason: z.string().trim().min(5).max(500),
});

export async function PATCH(request: NextRequest, { params }: Params) {
  const requestId = getRequestIdFromHeaders(request.headers);

  try {
    const user = await requireSuperadmin(request);
    const { tenantId, driverId } = await params;
    const json = await request.json().catch(() => null);
    const parsed = updateRestrictionSchema.safeParse(json);

    if (!parsed.success) {
      return bookingError(requestId, 'Invalid request body.', 400, 'INVALID_REQUEST');
    }

    const prisma = getPrisma();
    const result = await updateTenantWorkspaceDriverRestriction({
      prisma,
      tenantId,
      driverId,
      actedByUserId: user.id,
      isDriverRestricted: parsed.data.isDriverRestricted,
      reason: parsed.data.reason,
    });

    await createSuperadminTenantActionLogs({
      prisma,
      tenantId,
      superAdminUserId: user.id,
      module: AUDIT_MODULES.drivers,
      action: parsed.data.isDriverRestricted ? 'driver.restricted' : 'driver.reinstated',
      targetType: 'driver_profile',
      targetId: result.driverProfileId ?? driverId,
      reason: parsed.data.reason,
      accessType: 'driver_support',
      before: result.before,
      after: result.after,
    });

    return bookingSuccess(requestId, {
      driver: result.driver,
    });
  } catch (error) {
    return bookingErrorResponse(error, requestId);
  }
}
