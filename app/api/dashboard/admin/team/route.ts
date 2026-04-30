import { NextRequest } from 'next/server';
import { z } from 'zod';
import { BookingError } from '@/lib/booking/errors';
import { getPrisma } from '@/lib/prisma';
import { requireBookingProfile } from '@/lib/booking/auth';
import { bookingErrorResponse, bookingSuccess, getRequestIdFromHeaders } from '@/lib/booking/http';
import { AUDIT_MODULES, createTenantAuditLog } from '@/lib/audit-log';
import { inviteTenantTeamMember, mapTenantTeamMemberRow } from '@/lib/admin-team';
import {
  requireTenantMembershipWithPermissions,
  TENANT_PERMISSION_KEYS,
} from '@/lib/tenant-rbac';

const inviteBodySchema = z.object({
  name: z.string().trim().min(1).max(120),
  email: z.string().email(),
  tenantRoleKey: z.string().trim().min(1),
});

export async function GET(request: NextRequest) {
  const requestId = getRequestIdFromHeaders(request.headers);

  try {
    const prisma = getPrisma();
    const user = await requireBookingProfile(request);
    const access = await requireTenantMembershipWithPermissions(prisma, user, TENANT_PERMISSION_KEYS.teamView);

    const [memberships, roles] = await Promise.all([
      prisma.tenantMembership.findMany({
        where: { tenantId: access.tenantId },
        include: {
          User: {
            select: {
              name: true,
              email: true,
            },
          },
          TenantRole: {
            select: {
              key: true,
              name: true,
            },
          },
          InvitedByUser: {
            select: {
              name: true,
            },
          },
        },
        orderBy: [{ isActive: 'desc' }, { createdAt: 'asc' }],
      }),
      prisma.tenantRole.findMany({
        where: {
          scope: 'tenant',
          OR: [{ tenantId: null }, { tenantId: access.tenantId }],
        },
        orderBy: [{ isSystem: 'desc' }, { name: 'asc' }],
      }),
    ]);

    return bookingSuccess(requestId, {
      members: memberships.map(mapTenantTeamMemberRow),
      roles: roles.map((role) => ({
        id: role.id,
        key: role.key,
        name: role.name,
        description: role.description,
      })),
      currentUserPermissions: access.permissions,
    });
  } catch (error) {
    return bookingErrorResponse(error, requestId);
  }
}

export async function POST(request: NextRequest) {
  const requestId = getRequestIdFromHeaders(request.headers);

  try {
    const prisma = getPrisma();
    const user = await requireBookingProfile(request);
    const access = await requireTenantMembershipWithPermissions(prisma, user, TENANT_PERMISSION_KEYS.teamInvite);
    const json = await request.json().catch(() => null);
    const parsed = inviteBodySchema.safeParse(json);

    if (!parsed.success) {
      throw new BookingError('Invalid invite payload.', 400, 'INVALID_REQUEST');
    }

    const role = await prisma.tenantRole.findUnique({
      where: { key: parsed.data.tenantRoleKey },
    });

    if (!role) {
      throw new BookingError('Selected tenant role was not found.', 404, 'PROFILE_NOT_FOUND');
    }

    const result = await inviteTenantTeamMember({
      prisma,
      tenantId: access.tenantId,
      invitedByUserId: user.id,
      name: parsed.data.name,
      email: parsed.data.email,
      tenantRoleKey: parsed.data.tenantRoleKey,
    });

    const membership = await prisma.tenantMembership.findUniqueOrThrow({
      where: {
        userId_tenantId: {
          userId: result.user.id,
          tenantId: access.tenantId,
        },
      },
      include: {
        User: {
          select: {
            name: true,
            email: true,
          },
        },
        TenantRole: {
          select: {
            key: true,
            name: true,
          },
        },
        InvitedByUser: {
          select: {
            name: true,
          },
        },
      },
    });

    await createTenantAuditLog({
      prisma,
      tenantId: access.tenantId,
      actorUserId: user.id,
      module: AUDIT_MODULES.tenantTeam,
      action: 'team.member_invited',
      targetType: 'tenant_membership',
      targetId: membership.id,
      after: {
        userId: result.user.id,
        name: membership.User.name,
        email: membership.User.email,
        roleKey: membership.TenantRole.key,
        isActive: membership.isActive,
      },
    });

    return bookingSuccess(requestId, {
      member: mapTenantTeamMemberRow(membership),
      temporaryPassword: result.temporaryPassword,
    }, { status: 201 });
  } catch (error) {
    return bookingErrorResponse(error, requestId);
  }
}
