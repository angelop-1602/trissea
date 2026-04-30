import { randomUUID } from 'node:crypto';
import { Prisma } from '@prisma/client';
import type { PrismaClient, TenantMembership } from '@prisma/client';
import { BookingError } from '@/lib/booking/errors';
import { ACTIVE_ON_DEMAND_DRIVER_STATUSES } from '@/lib/booking/types';
import { computeAdminDriverStats } from '@/lib/admin-driver-management';
import { inviteTenantTeamMember, mapTenantTeamMemberRow } from '@/lib/admin-team';
import { assertDriverRestrictionTransition, assertDriverVerificationTransition } from '@/lib/driver-verification';
import { approveDriverProfile, ensureTenantDriverProfiles, setDriverRestrictionState } from '@/lib/driver-domain';
import { getTerminalCapacityValidationError } from '@/lib/dashboard/terminal-analytics';
import { ensureTenantSettings, normalizeTenantSettings } from '@/lib/tenant-settings';

type TenantRoleMembershipRecord = TenantMembership & {
  User: {
    name: string;
    email: string | null;
  };
  TenantRole: {
    key: string;
    name: string;
  };
  InvitedByUser: {
    name: string;
  } | null;
};

export async function getTenantOrThrow(prisma: PrismaClient, tenantId: string) {
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
  });

  if (!tenant) {
    throw new BookingError('Tenant not found.', 404, 'TENANT_REQUIRED');
  }

  return tenant;
}

export async function getTenantWorkspaceOverview(prisma: PrismaClient, tenantId: string) {
  const tenant = await getTenantOrThrow(prisma, tenantId);

  const [users, recentRides, recentReservations, terminals, memberships, supportAccessLogs, rideCounts, reservationCounts, completedRideAggregate] = await Promise.all([
    prisma.user.findMany({
      where: { tenantId },
      select: {
        id: true,
        role: true,
      },
    }),
    prisma.ride.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
      take: 10,
      include: {
        User_Ride_passengerIdToUser: {
          select: {
            id: true,
            name: true,
            phone: true,
          },
        },
        User_Ride_driverIdToUser: {
          select: {
            id: true,
            name: true,
            phone: true,
          },
        },
        TODATerminal: {
          select: {
            id: true,
            name: true,
            location: true,
          },
        },
      },
    }),
    prisma.reservation.findMany({
      where: { tenantId },
      orderBy: [{ status: 'asc' }, { queuePosition: 'asc' }, { createdAt: 'desc' }],
      take: 10,
      include: {
        User: {
          select: {
            id: true,
            name: true,
            phone: true,
          },
        },
        TODATerminal: {
          select: {
            id: true,
            name: true,
            location: true,
          },
        },
      },
    }),
    prisma.tODATerminal.findMany({
      where: { tenantId },
      orderBy: { name: 'asc' },
    }),
    prisma.tenantMembership.count({
      where: { tenantId, isActive: true },
    }),
    prisma.supportAccessLog.count({
      where: { tenantId },
    }),
    prisma.ride.groupBy({
      by: ['status'],
      where: { tenantId },
      _count: {
        status: true,
      },
    }),
    prisma.reservation.groupBy({
      by: ['status'],
      where: { tenantId },
      _count: {
        status: true,
      },
    }),
    prisma.ride.aggregate({
      where: {
        tenantId,
        status: 'completed',
      },
      _sum: {
        fare: true,
      },
    }),
  ]);

  const roleCounts = users.reduce(
    (acc, user) => {
      acc[user.role] += 1;
      return acc;
    },
    {
      passenger: 0,
      driver: 0,
      admin: 0,
      superadmin: 0,
    }
  );

  const totalRides = rideCounts.reduce((sum, item) => sum + item._count.status, 0);
  const activeRides = rideCounts.reduce(
    (sum, item) => sum + (['searching', 'matched', 'en_route', 'arrived', 'in_trip'].includes(item.status) ? item._count.status : 0),
    0
  );
  const totalReservations = reservationCounts.reduce((sum, item) => sum + item._count.status, 0);
  const activeReservations = reservationCounts.reduce(
    (sum, item) => sum + (['pending', 'confirmed', 'arrived'].includes(item.status) ? item._count.status : 0),
    0
  );
  const completedRevenue = completedRideAggregate._sum.fare ?? 0;

  return {
    tenant,
    stats: {
      passengers: roleCounts.passenger,
      drivers: roleCounts.driver,
      admins: roleCounts.admin,
      activeTeamMembers: memberships,
      terminals: terminals.length,
      totalRides,
      activeRides,
      totalReservations,
      activeReservations,
      completedRevenue,
      supportAccessCount: supportAccessLogs,
    },
    recentRides: recentRides.map(({ User_Ride_passengerIdToUser, User_Ride_driverIdToUser, TODATerminal, ...ride }) => ({
      ...ride,
      passenger: User_Ride_passengerIdToUser,
      driver: User_Ride_driverIdToUser,
      terminal: TODATerminal,
    })),
    recentReservations: recentReservations.map(({ User, TODATerminal, ...reservation }) => ({
      ...reservation,
      passenger: User,
      terminal: TODATerminal,
    })),
    roleCounts,
  };
}

export async function getTenantWorkspaceTeamData(prisma: PrismaClient, tenantId: string) {
  await getTenantOrThrow(prisma, tenantId);

  const [memberships, roles] = await Promise.all([
    prisma.tenantMembership.findMany({
      where: { tenantId },
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
        OR: [{ tenantId: null }, { tenantId }],
      },
      orderBy: [{ isSystem: 'desc' }, { name: 'asc' }],
    }),
  ]);

  return {
    members: memberships.map((membership) => mapTenantTeamMemberRow(membership as TenantRoleMembershipRecord)),
    roles: roles.map((role) => ({
      id: role.id,
      key: role.key,
      name: role.name,
      description: role.description,
    })),
  };
}

export async function inviteTenantWorkspaceMember(params: {
  prisma: PrismaClient;
  tenantId: string;
  invitedByUserId: string;
  name: string;
  email: string;
  tenantRoleKey: string;
}) {
  const role = await params.prisma.tenantRole.findUnique({
    where: { key: params.tenantRoleKey },
  });

  if (!role) {
    throw new BookingError('Selected tenant role was not found.', 404, 'PROFILE_NOT_FOUND');
  }

  await getTenantOrThrow(params.prisma, params.tenantId);

  const result = await inviteTenantTeamMember({
    prisma: params.prisma,
    tenantId: params.tenantId,
    invitedByUserId: params.invitedByUserId,
    name: params.name,
    email: params.email,
    tenantRoleKey: params.tenantRoleKey,
  });

  const membership = await params.prisma.tenantMembership.findUniqueOrThrow({
    where: {
      userId_tenantId: {
        userId: result.user.id,
        tenantId: params.tenantId,
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

  return {
    member: mapTenantTeamMemberRow(membership as TenantRoleMembershipRecord),
    temporaryPassword: result.temporaryPassword,
  };
}

export async function updateTenantWorkspaceMember(params: {
  prisma: PrismaClient;
  tenantId: string;
  membershipId: string;
  tenantRoleKey?: string;
  isActive?: boolean;
  protectedUserId?: string | null;
}) {
  if (params.tenantRoleKey === undefined && params.isActive === undefined) {
    throw new BookingError('At least one update field is required.', 400, 'INVALID_REQUEST');
  }

  const existingMembership = await params.prisma.tenantMembership.findUnique({
    where: { id: params.membershipId },
    include: {
      User: true,
      TenantRole: true,
    },
  });

  if (!existingMembership || existingMembership.tenantId !== params.tenantId) {
    throw new BookingError('Tenant team member not found.', 404, 'PROFILE_NOT_FOUND');
  }

  if (params.protectedUserId && existingMembership.userId === params.protectedUserId) {
    throw new BookingError('You cannot change your own tenant team membership from this screen.', 400, 'INVALID_ACTION');
  }

  const nextRole =
    params.tenantRoleKey !== undefined
      ? await params.prisma.tenantRole.findUnique({ where: { key: params.tenantRoleKey } })
      : existingMembership.TenantRole;

  if (!nextRole) {
    throw new BookingError('Selected tenant role was not found.', 404, 'PROFILE_NOT_FOUND');
  }

  const nextIsActive = params.isActive ?? existingMembership.isActive;
  const ownerStateChanging =
    existingMembership.TenantRole.key === 'tenant_owner' &&
    (!nextIsActive || nextRole.key !== existingMembership.TenantRole.key);

  if (ownerStateChanging) {
    const activeOwnerCount = await params.prisma.tenantMembership.count({
      where: {
        tenantId: params.tenantId,
        isActive: true,
        TenantRole: {
          key: 'tenant_owner',
        },
      },
    });

    if (activeOwnerCount <= 1) {
      throw new BookingError('Each tenant must keep at least one active tenant owner.', 400, 'INVALID_ACTION');
    }
  }

  await params.prisma.$transaction(async (tx) => {
    await tx.tenantMembership.update({
      where: { id: params.membershipId },
      data: {
        tenantRoleId: nextRole.id,
        isActive: nextIsActive,
        deactivatedAt: nextIsActive ? null : new Date(),
        updatedAt: new Date(),
      },
    });

    await tx.user.update({
      where: { id: existingMembership.userId },
      data: {
        tenantId: params.tenantId,
        role: 'admin',
        updatedAt: new Date(),
      },
    });
  });

  const membership = await params.prisma.tenantMembership.findUniqueOrThrow({
    where: { id: params.membershipId },
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

  return {
    before: {
      roleKey: existingMembership.TenantRole.key,
      isActive: existingMembership.isActive,
    },
    member: mapTenantTeamMemberRow(membership as TenantRoleMembershipRecord),
  };
}

export async function getTenantWorkspaceSettingsData(prisma: PrismaClient, tenantId: string) {
  const tenant = await getTenantOrThrow(prisma, tenantId);
  const tenantSettingsRecord = await ensureTenantSettings(prisma, tenant);
  const settings = normalizeTenantSettings(tenantSettingsRecord, tenant);

  return {
    tenant,
    settings,
  };
}

export async function updateTenantWorkspaceSettings(params: {
  prisma: PrismaClient;
  tenantId: string;
  input: Record<string, unknown>;
}) {
  const tenant = await getTenantOrThrow(params.prisma, params.tenantId);
  const normalized = normalizeTenantSettings(params.input, tenant);
  const existingSettings = await params.prisma.tenantSettings.findUnique({
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

  await params.prisma.$transaction([
    params.prisma.tenant.update({
      where: { id: tenant.id },
      data: {
        updatedAt: new Date(),
      },
    }),
    params.prisma.tenantSettings.upsert({
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

  return {
    tenant,
    settings: persistedSettings,
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
  };
}

export async function getTenantWorkspaceAuditData(
  prisma: PrismaClient,
  tenantId: string,
  filters?: {
    module?: string;
    action?: string;
    from?: string;
    to?: string;
  }
) {
  await getTenantOrThrow(prisma, tenantId);

  const logs = await (prisma as PrismaClient & {
    tenantAuditLog: {
      findMany: (args: unknown) => Promise<
        Array<{
          id: string;
          module: string;
          action: string;
          targetType: string;
          targetId: string | null;
          beforeJson: unknown;
          afterJson: unknown;
          createdAt: Date;
          ActorUser: {
            id: string;
            name: string;
            email: string | null;
          } | null;
        }>
      >;
    };
  }).tenantAuditLog.findMany({
    where: {
      tenantId,
      ...(filters?.module ? { module: filters.module } : {}),
      ...(filters?.action ? { action: filters.action } : {}),
      ...(filters?.from || filters?.to
        ? {
            createdAt: {
              ...(filters?.from ? { gte: new Date(filters.from) } : {}),
              ...(filters?.to ? { lte: new Date(filters.to) } : {}),
            },
          }
        : {}),
    },
    include: {
      ActorUser: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
    },
    orderBy: { createdAt: 'desc' },
    take: 200,
  });

  return {
    logs: logs.map((log) => ({
      id: log.id,
      module: log.module,
      action: log.action,
      targetType: log.targetType,
      targetId: log.targetId,
      beforeJson: log.beforeJson,
      afterJson: log.afterJson,
      createdAt: log.createdAt,
      actor: log.ActorUser,
    })),
  };
}

export async function getTenantWorkspaceDriversData(prisma: PrismaClient, tenantId: string) {
  await ensureTenantDriverProfiles(prisma, tenantId);

  const driverProfiles = await prisma.driverProfile.findMany({
    where: { tenantId },
    include: {
      User: {
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          rating: true,
          completedRides: true,
          createdAt: true,
        },
      },
      TODATerminal: {
        select: {
          name: true,
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  const presenceRecords = await prisma.driverPresence.findMany({
    where: {
      tenantId,
    },
    select: {
      driverId: true,
      isOnline: true,
      onlineSinceAt: true,
      lastHeartbeatAt: true,
    },
  });

  const presenceByDriverId = new Map(presenceRecords.map((record) => [record.driverId, record]));
  const drivers = driverProfiles.map((profile) => {
    const presence = presenceByDriverId.get(profile.userId);

    return {
      id: profile.userId,
      driverProfileId: profile.id,
      name: profile.legalFullName ?? profile.User.name,
      email: profile.contactEmail ?? profile.User.email,
      phone: profile.contactPhone ?? profile.User.phone,
      todaName: profile.TODATerminal?.name ?? null,
      verificationStatus: profile.verificationStatus,
      restrictionStatus: profile.restrictionStatus,
      operationalState: profile.operationalState,
      isDriverVerified: profile.verificationStatus === 'verified',
      isDriverRestricted: profile.restrictionStatus === 'restricted',
      rating: profile.User.rating ?? null,
      completedRides: profile.User.completedRides ?? 0,
      createdAt: profile.User.createdAt,
      DriverPresence: presence
        ? {
            isOnline: presence.isOnline,
            onlineSinceAt: presence.onlineSinceAt,
            lastHeartbeatAt: presence.lastHeartbeatAt,
          }
        : null,
    };
  });

  return {
    drivers,
    stats: computeAdminDriverStats(drivers),
  };
}

export async function updateTenantWorkspaceDriverVerification(params: {
  prisma: PrismaClient;
  tenantId: string;
  driverId: string;
  reviewedByUserId: string;
  isDriverVerified: boolean;
}) {
  await ensureTenantDriverProfiles(params.prisma, params.tenantId);
  const driver = await params.prisma.driverProfile.findFirst({
    where: {
      tenantId: params.tenantId,
      userId: params.driverId,
    },
    select: {
      id: true,
      userId: true,
      verificationStatus: true,
    },
  });

  if (!driver) {
    throw new BookingError('Driver not found.', 404, 'PROFILE_NOT_FOUND');
  }

  const isCurrentlyVerified = driver.verificationStatus === 'verified';
  if (isCurrentlyVerified === params.isDriverVerified) {
    return {
      driver: {
        id: driver.userId,
        isDriverVerified: isCurrentlyVerified,
      },
      before: {
        verificationStatus: driver.verificationStatus,
      },
      after: {
        verificationStatus: driver.verificationStatus,
      },
    };
  }

  assertDriverVerificationTransition({
    currentIsDriverVerified: isCurrentlyVerified,
    nextIsDriverVerified: params.isDriverVerified,
  });

  await approveDriverProfile({
    prisma: params.prisma,
    driverProfileId: driver.id,
    driverUserId: driver.userId,
    reviewedByUserId: params.reviewedByUserId,
  });

  return {
    driver: {
      id: driver.userId,
      isDriverVerified: true,
    },
    before: {
      verificationStatus: driver.verificationStatus,
    },
    after: {
      verificationStatus: 'verified',
    },
    driverProfileId: driver.id,
  };
}

export async function updateTenantWorkspaceDriverRestriction(params: {
  prisma: PrismaClient;
  tenantId: string;
  driverId: string;
  actedByUserId: string;
  isDriverRestricted: boolean;
  reason?: string;
}) {
  await ensureTenantDriverProfiles(params.prisma, params.tenantId);
  const driver = await params.prisma.driverProfile.findFirst({
    where: {
      tenantId: params.tenantId,
      userId: params.driverId,
    },
    select: {
      id: true,
      userId: true,
      verificationStatus: true,
      restrictionStatus: true,
      currentRestrictionReason: true,
      restrictedAt: true,
    },
  });

  if (!driver) {
    throw new BookingError('Driver not found.', 404, 'PROFILE_NOT_FOUND');
  }

  if (driver.verificationStatus !== 'verified') {
    throw new BookingError(
      'Driver must be verified before operational restrictions can be changed.',
      409,
      'INVALID_ACTION'
    );
  }

  const isCurrentlyRestricted = driver.restrictionStatus === 'restricted';
  if (isCurrentlyRestricted === params.isDriverRestricted) {
    return {
      driver: {
        id: driver.userId,
        isDriverRestricted: isCurrentlyRestricted,
        driverRestrictionReason: driver.currentRestrictionReason,
        driverRestrictedAt: driver.restrictedAt,
      },
      before: {
        restrictionStatus: driver.restrictionStatus,
        reason: driver.currentRestrictionReason,
      },
      after: {
        restrictionStatus: driver.restrictionStatus,
        reason: driver.currentRestrictionReason,
      },
      driverProfileId: driver.id,
    };
  }

  const activeRide = params.isDriverRestricted
    ? await params.prisma.ride.findFirst({
        where: {
          tenantId: params.tenantId,
          driverId: driver.userId,
          status: {
            in: ACTIVE_ON_DEMAND_DRIVER_STATUSES,
          },
        },
        select: { id: true },
      })
    : null;

  assertDriverRestrictionTransition({
    nextIsDriverRestricted: params.isDriverRestricted,
    hasActiveRide: Boolean(activeRide),
    reason: params.reason,
  });

  await setDriverRestrictionState({
    prisma: params.prisma,
    driverProfileId: driver.id,
    driverUserId: driver.userId,
    isRestricted: params.isDriverRestricted,
    actedByUserId: params.actedByUserId,
    reason: params.reason,
  });

  if (params.isDriverRestricted) {
    await params.prisma.driverPresence.updateMany({
      where: { driverId: driver.userId },
      data: {
        isOnline: false,
        onlineSinceAt: null,
      },
    });
  }

  return {
    driver: {
      id: driver.userId,
      isDriverRestricted: params.isDriverRestricted,
      driverRestrictionReason: params.isDriverRestricted ? params.reason?.trim() ?? null : null,
      driverRestrictedAt: params.isDriverRestricted ? new Date() : null,
    },
    before: {
      restrictionStatus: driver.restrictionStatus,
      reason: driver.currentRestrictionReason,
    },
    after: {
      restrictionStatus: params.isDriverRestricted ? 'restricted' : 'unrestricted',
      reason: params.isDriverRestricted ? params.reason?.trim() ?? null : null,
    },
    driverProfileId: driver.id,
  };
}

export async function getTenantWorkspaceTerminalsData(prisma: PrismaClient, tenantId: string) {
  await getTenantOrThrow(prisma, tenantId);

  const terminals = await prisma.tODATerminal.findMany({
    where: { tenantId },
    orderBy: { name: 'asc' },
  });

  return {
    terminals,
    stats: {
      totalTerminals: terminals.length,
      totalCapacity: terminals.reduce((sum, terminal) => sum + terminal.capacity, 0),
      currentlyQueued: terminals.reduce((sum, terminal) => sum + terminal.currentQueued, 0),
    },
  };
}

export async function createTenantWorkspaceTerminal(params: {
  prisma: PrismaClient;
  tenantId: string;
  input: {
    name: string;
    location: string;
    latitude: number;
    longitude: number;
  };
}) {
  await getTenantOrThrow(params.prisma, params.tenantId);
  const name = params.input.name.trim();
  const location = params.input.location.trim();

  const duplicate = await params.prisma.tODATerminal.findFirst({
    where: {
      tenantId: params.tenantId,
      name: {
        equals: name,
        mode: 'insensitive',
      },
    },
    select: { id: true },
  });

  if (duplicate) {
    throw new BookingError('A terminal with this name already exists.', 409, 'INVALID_REQUEST');
  }

  const terminal = await params.prisma.tODATerminal.create({
    data: {
      id: randomUUID(),
      tenantId: params.tenantId,
      name,
      location,
      latitude: params.input.latitude,
      longitude: params.input.longitude,
      capacity: 35,
      currentQueued: 0,
    },
  });

  return { terminal };
}

export async function updateTenantWorkspaceTerminal(params: {
  prisma: PrismaClient;
  tenantId: string;
  terminalId: string;
  input: {
    name?: string;
    location?: string;
    capacity?: number;
    latitude?: number;
    longitude?: number;
  };
}) {
  const terminal = await params.prisma.tODATerminal.findFirst({
    where: {
      id: params.terminalId,
      tenantId: params.tenantId,
    },
    select: {
      id: true,
      name: true,
      location: true,
      capacity: true,
      latitude: true,
      longitude: true,
      currentQueued: true,
    },
  });

  if (!terminal) {
    throw new BookingError('Terminal not found.', 404, 'TERMINAL_NOT_FOUND');
  }

  const updateData: {
    name?: string;
    location?: string;
    capacity?: number;
    latitude?: number;
    longitude?: number;
  } = {};

  if (params.input.name !== undefined) {
    updateData.name = params.input.name.trim();
    const duplicate = await params.prisma.tODATerminal.findFirst({
      where: {
        tenantId: params.tenantId,
        id: { not: terminal.id },
        name: {
          equals: updateData.name,
          mode: 'insensitive',
        },
      },
      select: { id: true },
    });

    if (duplicate) {
      throw new BookingError('A terminal with this name already exists.', 409, 'INVALID_REQUEST');
    }
  }

  if (params.input.location !== undefined) {
    updateData.location = params.input.location.trim();
  }

  if (params.input.capacity !== undefined) {
    const capacityError = getTerminalCapacityValidationError(params.input.capacity, terminal.currentQueued);
    if (capacityError) {
      throw new BookingError(capacityError, 400, 'INVALID_REQUEST');
    }
    updateData.capacity = params.input.capacity;
  }

  if (params.input.latitude !== undefined || params.input.longitude !== undefined) {
    if (params.input.latitude === undefined || params.input.longitude === undefined) {
      throw new BookingError('Latitude and longitude must be provided together.', 400, 'INVALID_REQUEST');
    }

    updateData.latitude = params.input.latitude;
    updateData.longitude = params.input.longitude;
  }

  const updatedTerminal = await params.prisma.tODATerminal.update({
    where: { id: terminal.id },
    data: updateData,
  });

  return {
    terminal: updatedTerminal,
    before: terminal,
    after: updatedTerminal,
  };
}

export async function getTenantWorkspaceRidesData(prisma: PrismaClient, tenantId: string) {
  await getTenantOrThrow(prisma, tenantId);

  const rides = await prisma.ride.findMany({
    where: { tenantId },
    orderBy: { createdAt: 'desc' },
    include: {
      User_Ride_passengerIdToUser: {
        select: {
          id: true,
          name: true,
          phone: true,
        },
      },
      User_Ride_driverIdToUser: {
        select: {
          id: true,
          name: true,
          phone: true,
        },
      },
      TODATerminal: {
        select: {
          id: true,
          name: true,
          location: true,
        },
      },
    },
  });

  return {
    rides: rides.map(({ User_Ride_passengerIdToUser, User_Ride_driverIdToUser, TODATerminal, ...ride }) => ({
      ...ride,
      passenger: User_Ride_passengerIdToUser,
      driver: User_Ride_driverIdToUser,
      terminal: TODATerminal,
    })),
    stats: {
      totalRides: rides.length,
      completedRides: rides.filter((ride) => ride.status === 'completed').length,
      totalFares: rides.reduce((sum, ride) => sum + ride.fare, 0),
    },
  };
}

export async function getTenantWorkspaceReservationsData(prisma: PrismaClient, tenantId: string) {
  await getTenantOrThrow(prisma, tenantId);

  const reservations = await prisma.reservation.findMany({
    where: { tenantId },
    include: {
      User: {
        select: {
          id: true,
          name: true,
          phone: true,
        },
      },
      TODATerminal: {
        select: {
          id: true,
          name: true,
          location: true,
        },
      },
    },
    orderBy: [{ status: 'asc' }, { queuePosition: 'asc' }, { createdAt: 'desc' }],
  });

  return {
    reservations: reservations.map(({ User, TODATerminal, ...reservation }) => ({
      ...reservation,
      passenger: User,
      terminal: TODATerminal,
    })),
    stats: {
      totalReservations: reservations.length,
      activeReservations: reservations.filter((reservation) =>
        ['pending', 'confirmed', 'arrived'].includes(reservation.status)
      ).length,
    },
  };
}
