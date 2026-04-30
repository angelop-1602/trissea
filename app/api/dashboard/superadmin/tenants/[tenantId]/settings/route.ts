import { NextRequest } from 'next/server';
import { z } from 'zod';
import { AUDIT_MODULES, createSuperadminTenantActionLogs } from '@/lib/audit-log';
import { BookingError } from '@/lib/booking/errors';
import { bookingError, bookingErrorResponse, bookingSuccess, getRequestIdFromHeaders } from '@/lib/booking/http';
import { getTenantWorkspaceSettingsData, updateTenantWorkspaceSettings } from '@/lib/dashboard/tenant-workspace';
import { getPrisma } from '@/lib/prisma';
import { requireSuperadmin } from '@/lib/superadmin-access';

interface Params {
  params: Promise<{ tenantId: string }>;
}

const updateSettingsSchema = z.object({
  settings: z.record(z.string(), z.unknown()),
  reason: z.string().trim().min(5).max(500),
});

export async function GET(request: NextRequest, { params }: Params) {
  const requestId = getRequestIdFromHeaders(request.headers);

  try {
    await requireSuperadmin(request);
    const { tenantId } = await params;
    const prisma = getPrisma();
    const data = await getTenantWorkspaceSettingsData(prisma, tenantId);

    return bookingSuccess(requestId, {
      settings: data.settings,
      tenant: {
        id: data.tenant.id,
        name: data.tenant.name,
        logo: data.tenant.logo,
        logoUrl: data.tenant.logoUrl,
        faviconUrl: data.tenant.faviconUrl,
        primaryColor: data.tenant.primaryColor,
        accentColor: data.tenant.accentColor,
        backgroundColor: data.tenant.backgroundColor,
        foregroundColor: data.tenant.foregroundColor,
        driverPrimaryColor: data.tenant.driverPrimaryColor,
        driverAccentColor: data.tenant.driverAccentColor,
        driverBackgroundColor: data.tenant.driverBackgroundColor,
        driverForegroundColor: data.tenant.driverForegroundColor,
      },
    });
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
    const parsed = updateSettingsSchema.safeParse(json);

    if (!parsed.success) {
      return bookingError(requestId, 'Invalid settings payload.', 400, 'INVALID_REQUEST');
    }

    const prisma = getPrisma();
    const result = await updateTenantWorkspaceSettings({
      prisma,
      tenantId,
      input: parsed.data.settings,
    });

    await createSuperadminTenantActionLogs({
      prisma,
      tenantId,
      superAdminUserId: user.id,
      module: AUDIT_MODULES.settings,
      action: 'settings.updated',
      targetType: 'tenant_settings',
      targetId: tenantId,
      reason: parsed.data.reason,
      accessType: 'settings_support',
      before: result.before,
      after: result.after,
    });

    return bookingSuccess(requestId, {
      settings: result.settings,
      tenant: {
        id: result.tenant.id,
        name: result.tenant.name,
        logo: result.tenant.logo,
        logoUrl: result.tenant.logoUrl,
        faviconUrl: result.tenant.faviconUrl,
        primaryColor: result.tenant.primaryColor,
        accentColor: result.tenant.accentColor,
        backgroundColor: result.tenant.backgroundColor,
        foregroundColor: result.tenant.foregroundColor,
        driverPrimaryColor: result.tenant.driverPrimaryColor,
        driverAccentColor: result.tenant.driverAccentColor,
        driverBackgroundColor: result.tenant.driverBackgroundColor,
        driverForegroundColor: result.tenant.driverForegroundColor,
      },
    });
  } catch (error) {
    if (error instanceof BookingError) {
      return bookingError(requestId, error.message, error.status, error.code);
    }

    return bookingErrorResponse(error, requestId);
  }
}
