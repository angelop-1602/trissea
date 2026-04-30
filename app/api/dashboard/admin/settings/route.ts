import { NextRequest } from 'next/server';
import { Prisma } from '@prisma/client';
import { BookingError } from '@/lib/booking/errors';
import { requireBookingProfile } from '@/lib/booking/auth';
import { bookingErrorResponse, bookingSuccess, getRequestIdFromHeaders } from '@/lib/booking/http';
import { AUDIT_MODULES, createTenantAuditLog } from '@/lib/audit-log';
import { getPrisma } from '@/lib/prisma';
import { requireTenantMembershipWithPermissions, TENANT_PERMISSION_KEYS } from '@/lib/tenant-rbac';
import { ensureTenantSettings, normalizeTenantSettings } from '@/lib/tenant-settings';

export async function GET(request: NextRequest) {
  const requestId = getRequestIdFromHeaders(request.headers);

  try {
    const prisma = getPrisma();
    const user = await requireBookingProfile(request);
    const access = await requireTenantMembershipWithPermissions(prisma, user, TENANT_PERMISSION_KEYS.settingsView);

    const tenant = await prisma.tenant.findUnique({
      where: { id: access.tenantId },
    });

    if (!tenant) {
      throw new BookingError('Tenant not found.', 404, 'TENANT_REQUIRED');
    }

    const tenantSettingsRecord = await ensureTenantSettings(prisma, tenant);
    const settings = normalizeTenantSettings(tenantSettingsRecord, tenant);

    return bookingSuccess(requestId, {
      settings,
      currentUserPermissions: access.permissions,
      tenant: {
        id: tenant.id,
        name: tenant.name,
        logo: tenant.logo,
        logoUrl: tenant.logoUrl,
        primaryColor: tenant.primaryColor,
        accentColor: tenant.accentColor,
      },
    });
  } catch (error) {
    return bookingErrorResponse(error, requestId);
  }
}

export async function PATCH(request: NextRequest) {
  const requestId = getRequestIdFromHeaders(request.headers);

  try {
    const prisma = getPrisma();
    const user = await requireBookingProfile(request);
    const access = await requireTenantMembershipWithPermissions(prisma, user, TENANT_PERMISSION_KEYS.settingsManage);
    const tenant = await prisma.tenant.findUnique({
      where: { id: access.tenantId },
    });

    if (!tenant) {
      throw new BookingError('Tenant not found.', 404, 'TENANT_REQUIRED');
    }

    const json = await request.json().catch(() => null);
    if (!json || typeof json !== 'object') {
      throw new BookingError('Invalid settings payload.', 400, 'INVALID_REQUEST');
    }

    const normalized = normalizeTenantSettings(json as Record<string, unknown>, tenant);
    const existingSettings = await prisma.tenantSettings.findUnique({
      where: { tenantId: tenant.id },
    });
    const persistedSettings = {
      ...normalized,
      branding: {
        displayName: tenant.name,
        logoUrl: tenant.logoUrl || tenant.logo || normalized.branding.logoUrl,
        primaryColor: tenant.primaryColor || normalized.branding.primaryColor,
        accentColor: tenant.accentColor || normalized.branding.accentColor,
      },
    };

    await prisma.$transaction([
      prisma.tenant.update({
        where: { id: tenant.id },
        data: {
          updatedAt: new Date(),
        },
      }),
      prisma.tenantSettings.upsert({
        where: { tenantId: tenant.id },
        update: {
          branding: persistedSettings.branding as Prisma.InputJsonValue,
          moduleVisibility: persistedSettings.moduleVisibility as Prisma.InputJsonValue,
          operationsPreferences: persistedSettings.operationsPreferences as unknown as Prisma.InputJsonValue,
          reportingPreferences: persistedSettings.reportingPreferences as Prisma.InputJsonValue,
          uiPreferences: persistedSettings.uiPreferences as Prisma.InputJsonValue,
          updatedAt: new Date(),
        },
        create: {
          id: `tenant-settings-${tenant.id}`,
          tenantId: tenant.id,
          branding: persistedSettings.branding as Prisma.InputJsonValue,
          moduleVisibility: persistedSettings.moduleVisibility as Prisma.InputJsonValue,
          operationsPreferences: persistedSettings.operationsPreferences as unknown as Prisma.InputJsonValue,
          reportingPreferences: persistedSettings.reportingPreferences as Prisma.InputJsonValue,
          uiPreferences: persistedSettings.uiPreferences as Prisma.InputJsonValue,
        },
      }),
    ]);

    await createTenantAuditLog({
      prisma,
      tenantId: tenant.id,
      actorUserId: user.id,
      module: AUDIT_MODULES.settings,
      action: 'settings.updated',
      targetType: 'tenant_settings',
      targetId: tenant.id,
      before: existingSettings
        ? {
            moduleVisibility: existingSettings.moduleVisibility,
            operationsPreferences: existingSettings.operationsPreferences,
            reportingPreferences: existingSettings.reportingPreferences,
            uiPreferences: existingSettings.uiPreferences,
          }
        : null,
      after: {
        moduleVisibility: persistedSettings.moduleVisibility,
        operationsPreferences: persistedSettings.operationsPreferences,
        reportingPreferences: persistedSettings.reportingPreferences,
        uiPreferences: persistedSettings.uiPreferences,
      },
    });

    return bookingSuccess(requestId, {
      settings: persistedSettings,
      currentUserPermissions: access.permissions,
      tenant: {
        id: tenant.id,
        name: tenant.name,
        logo: tenant.logo,
        logoUrl: tenant.logoUrl,
        primaryColor: tenant.primaryColor,
        accentColor: tenant.accentColor,
      },
    });
  } catch (error) {
    return bookingErrorResponse(error, requestId);
  }
}
