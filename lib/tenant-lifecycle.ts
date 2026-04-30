import type { PrismaClient, Tenant, User } from '@prisma/client';
import { BookingError } from '@/lib/booking/errors';

export type TenantLifecycleSnapshot = Pick<Tenant, 'id' | 'name' | 'status' | 'suspendedAt' | 'suspensionReason'>;
type TenantScopedUser = Pick<User, 'role' | 'tenantId'>;

export function isTenantSuspendedForUser(
  user: TenantScopedUser,
  tenant: TenantLifecycleSnapshot | null | undefined
) {
  return user.role !== 'superadmin' && Boolean(user.tenantId) && tenant?.status === 'suspended';
}

export function buildTenantSuspensionMessage(tenant: Pick<Tenant, 'name' | 'suspensionReason'>) {
  return tenant.suspensionReason?.trim() || `${tenant.name} is currently suspended by platform support.`;
}

export function assertTenantIsAccessible(
  user: TenantScopedUser,
  tenant: TenantLifecycleSnapshot | null | undefined
) {
  if (!tenant || !isTenantSuspendedForUser(user, tenant)) {
    return;
  }

  throw new BookingError(buildTenantSuspensionMessage(tenant), 403, 'TENANT_SUSPENDED');
}

export async function getTenantLifecycleSnapshot(prisma: PrismaClient, tenantId: string) {
  return prisma.tenant.findUnique({
    where: { id: tenantId },
    select: {
      id: true,
      name: true,
      status: true,
      suspendedAt: true,
      suspensionReason: true,
    },
  });
}
