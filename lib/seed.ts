import { getPrisma } from './prisma';
import { ensurePhoneE164Compatibility } from './prisma-compat';
import { createSupabaseAdminClient } from './supabase/server';
import { DEFAULT_BRAND_LOGO_PATH } from './brand';
import { findPSGCCityMunicipalityByName, getPSGCRegionNameByCode } from './psgc';
import { syncTenantRbacSeeds } from './tenant-rbac';
import { ensureTenantSettings } from './tenant-settings';
import { seedTuguegaraoFebruary2024, TUGUE_TENANT_ID } from './seed-data/tuguegarao-feb-2024';

const prisma = getPrisma();

const DEV_SEED_IDS = {
  superadmin: '66b86f6b-997c-4710-9425-78467c5dba73',
} as const;

const TUGUE_FALLBACK = {
  name: 'Tuguegarao City',
  psgcCode: '021529000',
  provinceCode: '021500000',
  provinceName: 'Cagayan',
  regionCode: '020000000',
  regionName: 'Cagayan Valley',
  lguType: 'city' as const,
  psgcType: 'city_municipality' as const,
};

function adminEmailDomain(): string {
  const configured = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  if (!configured || !configured.includes('@')) {
    return 'gmail.com';
  }

  return configured.split('@')[1] ?? 'gmail.com';
}

async function getOrCreateAuthUser(email: string, password: string) {
  const supabase = createSupabaseAdminClient();

  let createdData: { user?: { id?: string } | null } | null = null;
  let createError: unknown = null;

  try {
    const result = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });

    createdData = result.data as { user?: { id?: string } | null } | null;
    createError = result.error;
  } catch (error) {
    createError = error;
  }

  if (!createError && createdData?.user?.id) {
    return { id: createdData.user.id, email };
  }

  const errorCandidate = createError as { message?: string; code?: string; status?: number } | null;
  const createMessage = errorCandidate?.message?.toLowerCase() ?? '';
  const createCode = errorCandidate?.code?.toLowerCase() ?? '';
  const alreadyExists =
    createCode === 'email_exists' ||
    createMessage.includes('already registered') ||
    createMessage.includes('already exists') ||
    createMessage.includes('duplicate') ||
    createMessage.includes('email address has already been registered');

  if (!alreadyExists) {
    throw (createError as Error | null) ?? new Error('Failed to provision auth account.');
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

async function resolveTuguegaraoPSGC() {
  try {
    const city = await findPSGCCityMunicipalityByName('Tuguegarao City');
    if (city) {
      const regionName = (await getPSGCRegionNameByCode(city.regionCode)) ?? TUGUE_FALLBACK.regionName;
      return {
        name: city.name,
        psgcCode: city.code,
        provinceCode: city.provinceCode,
        provinceName: TUGUE_FALLBACK.provinceName,
        regionCode: city.regionCode,
        regionName,
        lguType: city.isCity ? ('city' as const) : ('municipality' as const),
        psgcType: 'city_municipality' as const,
      };
    }
  } catch {
    // Fallback to known PSGC values when external API is unavailable.
  }

  return TUGUE_FALLBACK;
}

async function upsertSuperadmin(email: string, supabaseId: string) {
  const existing = await prisma.user.findFirst({
    where: {
      OR: [
        { id: DEV_SEED_IDS.superadmin },
        {
          email: {
            equals: email,
            mode: 'insensitive',
          },
        },
      ],
    },
    orderBy: { createdAt: 'asc' },
  });

  const data = {
    name: 'Super Admin',
    email,
    role: 'superadmin' as const,
    supabaseId,
    tenantId: null,
    phone: null,
    phoneE164: null,
    mustResetPassword: false,
    updatedAt: new Date(),
  };

  if (existing) {
    return prisma.user.update({
      where: { id: existing.id },
      data,
    });
  }

  return prisma.user.create({
    data: {
      id: DEV_SEED_IDS.superadmin,
      ...data,
    },
  });
}

async function upsertTuguegaraoTenant() {
  const tugue = await resolveTuguegaraoPSGC();
  const existingTenant = await prisma.tenant.findFirst({
    where: {
      OR: [{ id: TUGUE_TENANT_ID }, { lguCode: tugue.psgcCode }],
    },
    orderBy: { createdAt: 'asc' },
  });

  const tenantData = {
    name: tugue.name,
    lguCode: tugue.psgcCode,
    lguName: tugue.name,
    lguType: tugue.lguType,
    psgcCode: tugue.psgcCode,
    psgcType: tugue.psgcType,
    provinceCode: tugue.provinceCode,
    provinceName: tugue.provinceName,
    regionCode: tugue.regionCode,
    regionName: tugue.regionName,
    logo: DEFAULT_BRAND_LOGO_PATH,
    logoUrl: DEFAULT_BRAND_LOGO_PATH,
    updatedAt: new Date(),
  };

  if (existingTenant) {
    return prisma.tenant.update({
      where: { id: existingTenant.id },
      data: tenantData,
    });
  }

  return prisma.tenant.create({
    data: {
      id: TUGUE_TENANT_ID,
      ...tenantData,
    },
  });
}

async function main() {
  await ensurePhoneE164Compatibility(prisma);
  await syncTenantRbacSeeds(prisma);

  const superadminEmail = process.env.SUPERADMIN_EMAIL?.trim().toLowerCase();
  const superadminPassword = process.env.SUPERADMIN_PASSWORD?.trim();

  if (!superadminEmail || !superadminPassword) {
    throw new Error('Missing SUPERADMIN_EMAIL or SUPERADMIN_PASSWORD in environment.');
  }

  const superadminAuthUser = await getOrCreateAuthUser(superadminEmail, superadminPassword);
  const superadmin = await upsertSuperadmin(superadminEmail, superadminAuthUser.id);
  const tenant = await upsertTuguegaraoTenant();
  await ensureTenantSettings(prisma, tenant);

  const seedSummary = await seedTuguegaraoFebruary2024({
    prisma,
    tenant,
    superadminUserId: superadmin.id,
    authProvisioner: getOrCreateAuthUser,
    adminEmailDomain: adminEmailDomain(),
  });

  const counts = {
    ...seedSummary.counts,
    User: seedSummary.counts.User + 1,
    TenantSettings: 1,
  };

  console.log('Seed complete');
  console.log(
    JSON.stringify(
      {
        superadmin: {
          email: superadmin.email,
          role: superadmin.role,
        },
        tenant: {
          name: tenant.name,
          provinceCode: tenant.provinceCode,
          provinceName: tenant.provinceName,
          regionName: tenant.regionName,
        },
        credentials: seedSummary.credentials,
        counts,
      },
      null,
      2
    )
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
