import { randomUUID } from 'node:crypto';
import { NextRequest } from 'next/server';
import { z } from 'zod';
import { getPrisma } from '@/lib/prisma';
import { bookingError, bookingErrorResponse, bookingSuccess, getRequestIdFromHeaders } from '@/lib/booking/http';
import { createPlatformAuditLog, AUDIT_MODULES } from '@/lib/audit-log';
import { DEFAULT_BRAND_LOGO_PATH } from '@/lib/brand';
import { listPlatformTenantsData } from '@/lib/dashboard/platform-control';
import { createSupabaseAdminClient } from '@/lib/supabase/server';
import { getPSGCLGUByCode } from '@/lib/psgc';
import { requireSuperadmin } from '@/lib/superadmin-access';
import { ensureTenantTransportModules } from '@/lib/transport-modules.server';

const createTenantSchema = z.object({
  lguCode: z.string().min(1),
  reason: z.string().trim().min(5).max(500),
});

function toSlug(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
}

function adminEmailDomain(): string {
  const configured = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  if (!configured || !configured.includes('@')) {
    return 'gmail.com';
  }

  return configured.split('@')[1] ?? 'gmail.com';
}

async function getOrCreateAuthUser(email: string, password: string) {
  const supabase = createSupabaseAdminClient();

  const { data: createdData, error: createError } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });

  if (!createError && createdData.user?.id) {
    return { id: createdData.user.id, email };
  }

  const createMessage = createError?.message?.toLowerCase() ?? '';
  const alreadyExists =
    createMessage.includes('already registered') ||
    createMessage.includes('already exists') ||
    createMessage.includes('duplicate');

  if (!alreadyExists) {
    throw createError ?? new Error('Failed to provision auth account.');
  }

  let page = 1;
  const perPage = 200;

  while (page > 0) {
    const { data: listData, error: listError } = await supabase.auth.admin.listUsers({ page, perPage });

    if (listError) {
      throw listError;
    }

    const payload = listData as
      | {
          users?: Array<{ id?: string; email?: string | null }>;
          nextPage?: number | null;
        }
      | null;

    const matched = (payload?.users ?? []).find((user) => user.email?.toLowerCase() === email);

    if (matched?.id) {
      await supabase.auth.admin.updateUserById(matched.id, {
        email,
        password,
        email_confirm: true,
      });

      return { id: matched.id, email };
    }

    page = payload?.nextPage ?? 0;
  }

  throw new Error(`Unable to find existing auth user for ${email}.`);
}

export async function GET(request: NextRequest) {
  const requestId = getRequestIdFromHeaders(request.headers);

  try {
    await requireSuperadmin(request);
    const prisma = getPrisma();
    const { searchParams } = new URL(request.url);
    const data = await listPlatformTenantsData(prisma, {
      query: searchParams.get('query')?.trim() || undefined,
      regionCode: searchParams.get('regionCode')?.trim() || undefined,
      status: (searchParams.get('status')?.trim() as 'active' | 'suspended' | 'all' | null) ?? undefined,
    });

    return bookingSuccess(requestId, data);
  } catch (error) {
    return bookingErrorResponse(error, requestId);
  }
}

export async function POST(request: NextRequest) {
  const requestId = getRequestIdFromHeaders(request.headers);

  try {
    const user = await requireSuperadmin(request);

    const body = await request.json().catch(() => null);
    const parsed = createTenantSchema.safeParse(body);

    if (!parsed.success) {
      return bookingError(requestId, 'Invalid request body.', 400, 'INVALID_REQUEST');
    }

    const selectedLgu = await getPSGCLGUByCode(parsed.data.lguCode);
    if (!selectedLgu) {
      return bookingError(requestId, 'Invalid LGU selection.', 400, 'INVALID_REQUEST');
    }

    const prisma = getPrisma();
    const existing = await prisma.tenant.findFirst({
      where: {
        lguCode: selectedLgu.code,
      },
    });

    if (existing) {
      return bookingError(requestId, 'A tenant already exists for this LGU.', 409, 'INVALID_REQUEST');
    }

    const now = new Date();
    const adminPassword = `mobility@${now.getFullYear()}`;
    const slug = toSlug(selectedLgu.name);
    const adminEmail = `admin.${slug}.${selectedLgu.code}@${adminEmailDomain()}`;

    const authUser = await getOrCreateAuthUser(adminEmail, adminPassword);

    const tenant = await prisma.tenant.create({
      data: {
        id: randomUUID(),
        name: selectedLgu.name,
        lguCode: selectedLgu.code,
        lguName: selectedLgu.name,
        lguType: selectedLgu.lguType,
        psgcCode: selectedLgu.code,
        psgcType: selectedLgu.lguType === 'province' ? 'province' : 'city_municipality',
        provinceCode: selectedLgu.provinceCode,
        provinceName: selectedLgu.provinceName,
        regionCode: selectedLgu.regionCode,
        regionName: selectedLgu.regionName,
        logo: DEFAULT_BRAND_LOGO_PATH,
        logoUrl: DEFAULT_BRAND_LOGO_PATH,
      },
    });
    await ensureTenantTransportModules(prisma, tenant);

    const existingTenantAdmin = await prisma.user.findFirst({
      where: {
        email: {
          equals: adminEmail,
          mode: 'insensitive',
        },
        role: 'admin',
      },
      orderBy: { createdAt: 'asc' },
    });

    const tenantAdmin = existingTenantAdmin
      ? await prisma.user.update({
          where: { id: existingTenantAdmin.id },
          data: {
            name: `${selectedLgu.name} Admin`,
            email: adminEmail,
            supabaseId: authUser.id,
            tenantId: tenant.id,
            mustResetPassword: true,
            updatedAt: new Date(),
          },
        })
      : await prisma.user.create({
          data: {
            id: randomUUID(),
            name: `${selectedLgu.name} Admin`,
            email: adminEmail,
            role: 'admin',
            supabaseId: authUser.id,
            tenantId: tenant.id,
            phone: null,
            phoneE164: null,
            mustResetPassword: true,
            updatedAt: new Date(),
      },
    });

    await createPlatformAuditLog({
      prisma,
      actorUserId: user.id,
      tenantId: tenant.id,
      module: AUDIT_MODULES.tenants,
      action: 'tenant.created',
      targetType: 'tenant',
      targetId: tenant.id,
      reason: parsed.data.reason,
      after: {
        tenantId: tenant.id,
        tenantName: tenant.name,
        adminEmail,
      },
    });

    return bookingSuccess(requestId, {
      tenant,
      tenantAdmin,
      credentials: {
        email: adminEmail,
        temporaryPassword: adminPassword,
      },
    });
  } catch (error) {
    return bookingErrorResponse(error, requestId);
  }
}
