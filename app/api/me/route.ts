import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { AuthError } from '@/lib/auth';
import { requireBookingProfile } from '@/lib/booking/auth';
import { getPrisma } from '@/lib/prisma';
import { ensurePhoneE164Compatibility } from '@/lib/prisma-compat';
import { getTenantPermissionKeysForUser } from '@/lib/tenant-rbac';
import { ensureTenantSettings, normalizeTenantSettings } from '@/lib/tenant-settings';
import { getFallbackTransportModules } from '@/lib/transport-modules';
import { getTransportModulesForTenant } from '@/lib/transport-modules.server';

export async function GET(request: NextRequest) {
  const prisma = getPrisma();
  let user;

  try {
    user = await requireBookingProfile(request, {
      allowPendingDriver: true,
      allowRestrictedDriver: true,
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
    }
    if (error instanceof Error && 'status' in error && 'code' in error) {
      const coded = error as Error & { status: number; code: string };
      return NextResponse.json({ error: coded.message, code: coded.code }, { status: coded.status });
    }
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  }

  await ensurePhoneE164Compatibility(prisma);
  
  let tenant = null;
  let tenantSettings = null;
  let transportModules = user.role === 'superadmin' ? [] : getFallbackTransportModules();
  if (user.tenantId) {
    try {
      tenant = await prisma.tenant.findUnique({
        where: { id: user.tenantId },
      });
      if (tenant) {
        const ensuredSettings = await ensureTenantSettings(prisma, tenant);
        tenantSettings = normalizeTenantSettings(ensuredSettings, tenant);
        transportModules = await getTransportModulesForTenant(prisma, tenant.id);
      }
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2022') {
        tenant = null;
      } else {
        throw error;
      }
    }
  }

  return NextResponse.json({
    user,
    tenant,
    tenantSettings,
    transportModules,
    permissions: await getTenantPermissionKeysForUser(prisma, user),
  });
}
