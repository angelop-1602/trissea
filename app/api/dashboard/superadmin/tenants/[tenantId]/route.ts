import { NextRequest } from 'next/server';
import { z } from 'zod';
import { AUDIT_MODULES, createPlatformAuditLog, createSuperadminTenantActionLogs } from '@/lib/audit-log';
import { bookingError, bookingErrorResponse, bookingSuccess, getRequestIdFromHeaders } from '@/lib/booking/http';
import { getPlatformTenantDetailData, updatePlatformTenantProfile } from '@/lib/dashboard/platform-control';
import { getPrisma } from '@/lib/prisma';
import { requireSuperadmin } from '@/lib/superadmin-access';

const optionalHexColorSchema = z
  .union([z.string().trim().max(40), z.null()])
  .refine((value) => value === null || value === '' || /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i.test(value), {
    message: 'Color must be a hex value like #14622e.',
  })
  .optional();

const updateTenantSchema = z
  .object({
    status: z.enum(['active', 'suspended']).optional(),
    suspensionReason: z.union([z.string().trim().max(500), z.null()]).optional(),
    logoUrl: z.union([z.string().trim().max(500), z.null()]).optional(),
    faviconUrl: z.union([z.string().trim().max(500), z.null()]).optional(),
    primaryColor: optionalHexColorSchema,
    accentColor: optionalHexColorSchema,
    backgroundColor: optionalHexColorSchema,
    foregroundColor: optionalHexColorSchema,
    driverPrimaryColor: optionalHexColorSchema,
    driverAccentColor: optionalHexColorSchema,
    driverBackgroundColor: optionalHexColorSchema,
    driverForegroundColor: optionalHexColorSchema,
    reason: z.string().trim().min(5).max(500),
  })
  .refine(
    (value) =>
      value.status !== undefined ||
      value.suspensionReason !== undefined ||
      value.logoUrl !== undefined ||
      value.faviconUrl !== undefined ||
      value.primaryColor !== undefined ||
      value.accentColor !== undefined ||
      value.backgroundColor !== undefined ||
      value.foregroundColor !== undefined ||
      value.driverPrimaryColor !== undefined ||
      value.driverAccentColor !== undefined ||
      value.driverBackgroundColor !== undefined ||
      value.driverForegroundColor !== undefined,
    {
      message: 'At least one tenant update field is required.',
    }
  );

interface Params {
  params: Promise<{ tenantId: string }>;
}

export async function GET(request: NextRequest, { params }: Params) {
  const requestId = getRequestIdFromHeaders(request.headers);

  try {
    await requireSuperadmin(request);
    const { tenantId } = await params;
    const prisma = getPrisma();
    const data = await getPlatformTenantDetailData(prisma, tenantId);

    return bookingSuccess(requestId, data);
  } catch (error) {
    return bookingErrorResponse(error, requestId);
  }
}

export async function PATCH(request: NextRequest, { params }: Params) {
  const requestId = getRequestIdFromHeaders(request.headers);

  try {
    const user = await requireSuperadmin(request);
    const { tenantId } = await params;
    const json = await request.json().catch(() => null);
    const parsed = updateTenantSchema.safeParse(json);

    if (!parsed.success) {
      return bookingError(requestId, 'Invalid tenant payload.', 400, 'INVALID_REQUEST');
    }

    const prisma = getPrisma();
    const result = await updatePlatformTenantProfile({
      prisma,
      tenantId,
      status: parsed.data.status,
      suspensionReason: parsed.data.suspensionReason,
      logoUrl: parsed.data.logoUrl,
      faviconUrl: parsed.data.faviconUrl,
      primaryColor: parsed.data.primaryColor,
      accentColor: parsed.data.accentColor,
      backgroundColor: parsed.data.backgroundColor,
      foregroundColor: parsed.data.foregroundColor,
      driverPrimaryColor: parsed.data.driverPrimaryColor,
      driverAccentColor: parsed.data.driverAccentColor,
      driverBackgroundColor: parsed.data.driverBackgroundColor,
      driverForegroundColor: parsed.data.driverForegroundColor,
    });

    if (parsed.data.status !== undefined) {
      await createSuperadminTenantActionLogs({
        prisma,
        tenantId,
        superAdminUserId: user.id,
        module: AUDIT_MODULES.tenants,
        action: parsed.data.status === 'suspended' ? 'tenant.suspended' : 'tenant.activated',
        targetType: 'tenant',
        targetId: tenantId,
        reason: parsed.data.reason,
        accessType: 'tenant_lifecycle',
        before: result.before,
        after: result.after,
      });
    } else {
      await createPlatformAuditLog({
        prisma,
        actorUserId: user.id,
        tenantId,
        module: AUDIT_MODULES.tenants,
        action: 'tenant.branding_updated',
        targetType: 'tenant',
        targetId: tenantId,
        reason: parsed.data.reason,
        before: result.before,
        after: result.after,
      });
    }

    return bookingSuccess(requestId, {
      tenant: result.tenant,
    });
  } catch (error) {
    return bookingErrorResponse(error, requestId);
  }
}
