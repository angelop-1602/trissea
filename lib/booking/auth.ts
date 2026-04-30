import { NextRequest } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { getPrisma } from '@/lib/prisma';
import { ensurePhoneE164Compatibility } from '@/lib/prisma-compat';
import type { BookingActor } from '@/lib/booking/types';
import { BookingError } from '@/lib/booking/errors';
import { resolveDriverAccessState } from '@/lib/driver-access';
import { createDriverAccessSnapshot, getDriverProfileByUserId } from '@/lib/driver-domain';
import { assertTenantIsAccessible, getTenantLifecycleSnapshot } from '@/lib/tenant-lifecycle';
import { assertActiveAdminTenantMembership } from '@/lib/tenant-rbac';

async function findBookingProfileBySupabaseId(prisma: ReturnType<typeof getPrisma>, supabaseId: string) {
  return prisma.user.findUnique({
    where: { supabaseId },
  });
}

async function findBookingProfileByUserId(prisma: ReturnType<typeof getPrisma>, userId: string) {
  return prisma.user.findUnique({
    where: { id: userId },
  });
}

export type BookingProfile = NonNullable<
  Awaited<ReturnType<typeof findBookingProfileBySupabaseId>> | Awaited<ReturnType<typeof findBookingProfileByUserId>>
>;

interface RequireBookingProfileOptions {
  allowPendingDriver?: boolean;
  allowRestrictedDriver?: boolean;
}

export function assertDriverVerified(
  profile: Pick<BookingProfile, 'role' | 'isDriverVerified' | 'isDriverRestricted'>,
  options: RequireBookingProfileOptions = {}
) {
  const state = resolveDriverAccessState(profile);

  if (state === 'pending' && !options.allowPendingDriver) {
    throw new BookingError('Driver account is pending admin verification.', 403, 'DRIVER_NOT_VERIFIED');
  }

  if (state === 'restricted' && !options.allowRestrictedDriver) {
    throw new BookingError('Driver account is currently restricted by an administrator.', 403, 'DRIVER_RESTRICTED');
  }
}

export async function requireBookingProfile(
  request: NextRequest,
  options: RequireBookingProfileOptions = {}
): Promise<BookingProfile> {
  const auth = await requireAuth(request);
  const prisma = getPrisma();
  await ensurePhoneE164Compatibility(prisma);

  const user = auth.userId
    ? await findBookingProfileByUserId(prisma, auth.userId)
    : auth.supabaseUserId
      ? await findBookingProfileBySupabaseId(prisma, auth.supabaseUserId)
      : null;

  if (!user) {
    throw new BookingError('User profile not found.', 404, 'PROFILE_NOT_FOUND');
  }

  const driverProfile = user.role === 'driver' ? await getDriverProfileByUserId(prisma, user.id) : null;
  const driverAccessSnapshot = createDriverAccessSnapshot({ user, driverProfile });
  assertDriverVerified(driverAccessSnapshot, options);
  await assertActiveAdminTenantMembership(prisma, user);
  if (user.tenantId) {
    const tenant = await getTenantLifecycleSnapshot(prisma, user.tenantId);
    assertTenantIsAccessible(user, tenant);
  }

  if (user.role !== 'driver') {
    return user;
  }

  return {
    ...user,
    isDriverVerified: driverAccessSnapshot.isDriverVerified,
    isDriverRestricted: driverAccessSnapshot.isDriverRestricted,
  };
}

export function toBookingActor(user: BookingProfile): BookingActor {
  return {
    id: user.id,
    role: user.role,
    tenantId: user.tenantId,
  };
}

export function requireActorTenantId(actor: BookingActor): string {
  if (!actor.tenantId) {
    throw new BookingError('Tenant context is required for this account.', 400, 'TENANT_REQUIRED');
  }

  return actor.tenantId;
}
