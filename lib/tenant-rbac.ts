import type { PrismaClient, User } from '@prisma/client';
import { BookingError } from '@/lib/booking/errors';

export const TENANT_PERMISSION_KEYS = {
  teamView: 'tenant.team.view',
  teamInvite: 'tenant.team.invite',
  teamRolesManage: 'tenant.team.roles.manage',
  teamMembersManageStatus: 'tenant.team.members.manage_status',
  settingsView: 'tenant.settings.view',
  settingsManage: 'tenant.settings.manage',
  auditView: 'tenant.audit.view',
} as const;

export type TenantPermissionKey = (typeof TENANT_PERMISSION_KEYS)[keyof typeof TENANT_PERMISSION_KEYS];

export const DEFAULT_TENANT_ROLE_DEFINITIONS = [
  {
    id: 'tenant-role-tenant-owner',
    key: 'tenant_owner',
    name: 'Tenant Owner',
    description: 'Full tenant control, including tenant team management.',
    permissions: [
      TENANT_PERMISSION_KEYS.teamView,
      TENANT_PERMISSION_KEYS.teamInvite,
      TENANT_PERMISSION_KEYS.teamRolesManage,
      TENANT_PERMISSION_KEYS.teamMembersManageStatus,
      TENANT_PERMISSION_KEYS.settingsView,
      TENANT_PERMISSION_KEYS.settingsManage,
      TENANT_PERMISSION_KEYS.auditView,
    ],
  },
  {
    id: 'tenant-role-tenant-admin',
    key: 'tenant_admin',
    name: 'Tenant Admin',
    description: 'Daily tenant operator with team management access.',
    permissions: [
      TENANT_PERMISSION_KEYS.teamView,
      TENANT_PERMISSION_KEYS.teamInvite,
      TENANT_PERMISSION_KEYS.teamRolesManage,
      TENANT_PERMISSION_KEYS.teamMembersManageStatus,
      TENANT_PERMISSION_KEYS.settingsView,
      TENANT_PERMISSION_KEYS.settingsManage,
      TENANT_PERMISSION_KEYS.auditView,
    ],
  },
  {
    id: 'tenant-role-dispatcher',
    key: 'dispatcher',
    name: 'Dispatcher',
    description: 'Dispatch-focused tenant staff role.',
    permissions: [],
  },
  {
    id: 'tenant-role-driver-reviewer',
    key: 'driver_reviewer',
    name: 'Driver Reviewer',
    description: 'Tenant staff role focused on driver review workflows.',
    permissions: [],
  },
  {
    id: 'tenant-role-reports-viewer',
    key: 'reports_viewer',
    name: 'Reports Viewer',
    description: 'Read-only reporting role for tenant staff.',
    permissions: [TENANT_PERMISSION_KEYS.auditView],
  },
] as const;

export const DEFAULT_TENANT_ROLE_KEYS = DEFAULT_TENANT_ROLE_DEFINITIONS.map((role) => role.key);

export async function syncTenantRbacSeeds(prisma: PrismaClient) {
  await prisma.$transaction(
    async (tx) => {
      for (const role of DEFAULT_TENANT_ROLE_DEFINITIONS) {
        await tx.tenantRole.upsert({
          where: { key: role.key },
          update: {
            name: role.name,
            description: role.description,
            isSystem: true,
            tenantId: null,
          },
          create: {
            id: role.id,
            key: role.key,
            name: role.name,
            description: role.description,
            isSystem: true,
            tenantId: null,
          },
        });

        await tx.tenantRolePermission.deleteMany({
          where: { tenantRoleId: role.id },
        });

        if (role.permissions.length > 0) {
          await tx.tenantRolePermission.createMany({
            data: role.permissions.map((permissionKey) => ({
              id: `${role.id}::${permissionKey}`,
              tenantRoleId: role.id,
              permissionKey,
            })),
            skipDuplicates: true,
          });
        }
      }
    },
    { timeout: 20_000 }
  );
}

export async function getActiveTenantMembershipForUser(prisma: PrismaClient, userId: string, tenantId: string) {
  return prisma.tenantMembership.findUnique({
    where: {
      userId_tenantId: {
        userId,
        tenantId,
      },
    },
    include: {
      TenantRole: {
        include: {
          TenantRolePermission: true,
        },
      },
    },
  });
}

export async function getTenantPermissionKeysForUser(
  prisma: PrismaClient,
  user: Pick<User, 'id' | 'role' | 'tenantId'>
) {
  if (user.role !== 'admin' || !user.tenantId) {
    return [];
  }

  const membership = await getActiveTenantMembershipForUser(prisma, user.id, user.tenantId);
  if (!membership || !membership.isActive) {
    return [];
  }

  return membership.TenantRole.TenantRolePermission.map((item) => item.permissionKey);
}

export async function assertActiveAdminTenantMembership(
  prisma: PrismaClient,
  user: Pick<User, 'id' | 'role' | 'tenantId'>
) {
  if (user.role !== 'admin') {
    return;
  }

  if (!user.tenantId) {
    throw new BookingError('Tenant context is required for this account.', 400, 'TENANT_REQUIRED');
  }

  const membership = await getActiveTenantMembershipForUser(prisma, user.id, user.tenantId);

  if (!membership || !membership.isActive) {
    throw new BookingError('This tenant staff account is inactive.', 403, 'TENANT_MEMBERSHIP_INACTIVE');
  }
}

export async function requireTenantMembershipWithPermissions(
  prisma: PrismaClient,
  user: Pick<User, 'id' | 'role' | 'tenantId'>,
  permissions?: TenantPermissionKey | TenantPermissionKey[]
) {
  if (user.role !== 'admin') {
    throw new BookingError('Only tenant admin accounts can access this resource.', 403, 'FORBIDDEN_ROLE');
  }

  if (!user.tenantId) {
    throw new BookingError('Tenant context is required for this account.', 400, 'TENANT_REQUIRED');
  }

  const membership = await getActiveTenantMembershipForUser(prisma, user.id, user.tenantId);

  if (!membership || !membership.isActive) {
    throw new BookingError('An active tenant membership is required for this action.', 403, 'TENANT_MEMBERSHIP_REQUIRED');
  }

  const permissionSet = new Set(membership.TenantRole.TenantRolePermission.map((item) => item.permissionKey));
  const requiredPermissions = Array.isArray(permissions) ? permissions : permissions ? [permissions] : [];

  for (const permission of requiredPermissions) {
    if (!permissionSet.has(permission)) {
      throw new BookingError('Your tenant role does not allow this action.', 403, 'FORBIDDEN_PERMISSION');
    }
  }

  return {
    tenantId: user.tenantId,
    membership,
    permissions: Array.from(permissionSet),
  };
}

export async function upsertTenantMembership(params: {
  prisma: PrismaClient;
  userId: string;
  tenantId: string;
  tenantRoleKey: string;
  invitedByUserId?: string | null;
  isActive?: boolean;
}) {
  const role = await params.prisma.tenantRole.findUnique({
    where: { key: params.tenantRoleKey },
  });

  if (!role) {
    throw new Error(`Unknown tenant role: ${params.tenantRoleKey}`);
  }

  const membershipId = `tenant-membership-${params.userId}-${params.tenantId}`;
  const isActive = params.isActive ?? true;

  return params.prisma.tenantMembership.upsert({
    where: {
      userId_tenantId: {
        userId: params.userId,
        tenantId: params.tenantId,
      },
    },
    update: {
      tenantRoleId: role.id,
      invitedByUserId: params.invitedByUserId ?? null,
      isActive,
      deactivatedAt: isActive ? null : new Date(),
      updatedAt: new Date(),
    },
    create: {
      id: membershipId,
      userId: params.userId,
      tenantId: params.tenantId,
      tenantRoleId: role.id,
      invitedByUserId: params.invitedByUserId ?? null,
      isActive,
      deactivatedAt: isActive ? null : new Date(),
    },
  });
}
