import type { PrismaClient, TenantStatus } from '@prisma/client';
import { DEFAULT_BRAND_LOGO_PATH, normalizeBrandLogoPath } from '@/lib/brand';
import { BookingError } from '@/lib/booking/errors';
import { getTenantWorkspaceOverview } from '@/lib/dashboard/tenant-workspace';
import { DEFAULT_ACCENT_HEX, DEFAULT_PRIMARY_HEX } from '@/lib/theme/constants';

type TenantDirectoryFilters = {
  query?: string;
  regionCode?: string;
  status?: TenantStatus | 'all';
};

type PassengerDirectoryFilters = {
  query?: string;
  tenantId?: string;
  activity?: 'all' | 'active' | 'inactive';
};

export async function listPlatformTenantsData(prisma: PrismaClient, filters?: TenantDirectoryFilters) {
  const query = filters?.query?.trim();
  const tenants = await prisma.tenant.findMany({
    where: {
      ...(filters?.regionCode && filters.regionCode !== 'all' ? { regionCode: filters.regionCode } : {}),
      ...(filters?.status && filters.status !== 'all' ? { status: filters.status } : {}),
      ...(query
        ? {
            OR: [
              { name: { contains: query, mode: 'insensitive' } },
              { lguName: { contains: query, mode: 'insensitive' } },
              { regionName: { contains: query, mode: 'insensitive' } },
              { provinceName: { contains: query, mode: 'insensitive' } },
            ],
          }
        : {}),
    },
    orderBy: [{ status: 'asc' }, { name: 'asc' }],
  });

  const tenantIds = tenants.map((tenant) => tenant.id);
  const [userCounts, rideCounts, reservationCounts, terminalCounts] = tenantIds.length
    ? await Promise.all([
        prisma.user.groupBy({
          by: ['tenantId', 'role'],
          where: {
            tenantId: { in: tenantIds },
          },
          _count: {
            role: true,
          },
        }),
        prisma.ride.groupBy({
          by: ['tenantId'],
          where: {
            tenantId: { in: tenantIds },
          },
          _count: {
            tenantId: true,
          },
          _sum: {
            fare: true,
          },
        }),
        prisma.reservation.groupBy({
          by: ['tenantId'],
          where: {
            tenantId: { in: tenantIds },
          },
          _count: {
            tenantId: true,
          },
        }),
        prisma.tODATerminal.groupBy({
          by: ['tenantId'],
          where: {
            tenantId: { in: tenantIds },
          },
          _count: {
            tenantId: true,
          },
        }),
      ])
    : [[], [], [], []];

  const userCountMap = new Map<string, { totalUsers: number; passengers: number; drivers: number; admins: number }>();
  for (const item of userCounts) {
    const existing = userCountMap.get(item.tenantId ?? '') ?? {
      totalUsers: 0,
      passengers: 0,
      drivers: 0,
      admins: 0,
    };

    existing.totalUsers += item._count.role;
    if (item.role === 'passenger') existing.passengers += item._count.role;
    if (item.role === 'driver') existing.drivers += item._count.role;
    if (item.role === 'admin') existing.admins += item._count.role;
    userCountMap.set(item.tenantId ?? '', existing);
  }

  const rideCountMap = new Map(rideCounts.map((item) => [item.tenantId, item]));
  const reservationCountMap = new Map(reservationCounts.map((item) => [item.tenantId, item]));
  const terminalCountMap = new Map(terminalCounts.map((item) => [item.tenantId, item]));

  return {
    tenants: tenants.map((tenant) => {
      const userCountsForTenant = userCountMap.get(tenant.id) ?? {
        totalUsers: 0,
        passengers: 0,
        drivers: 0,
        admins: 0,
      };
      const rideCountsForTenant = rideCountMap.get(tenant.id);
      const reservationCountsForTenant = reservationCountMap.get(tenant.id);
      const terminalCountsForTenant = terminalCountMap.get(tenant.id);

      return {
        ...tenant,
        users: userCountsForTenant.totalUsers,
        passengers: userCountsForTenant.passengers,
        drivers: userCountsForTenant.drivers,
        admins: userCountsForTenant.admins,
        rides: rideCountsForTenant?._count.tenantId ?? 0,
        reservations: reservationCountsForTenant?._count.tenantId ?? 0,
        terminals: terminalCountsForTenant?._count.tenantId ?? 0,
        revenue: rideCountsForTenant?._sum.fare ?? 0,
      };
    }),
    regions: Array.from(
      new Map(
        tenants
          .filter((tenant) => tenant.regionCode && tenant.regionName)
          .map((tenant) => [tenant.regionCode as string, { code: tenant.regionCode as string, name: tenant.regionName as string }])
      ).values()
    ),
  };
}

export async function getPlatformTenantDetailData(prisma: PrismaClient, tenantId: string) {
  return getTenantWorkspaceOverview(prisma, tenantId);
}

export async function updatePlatformTenantProfile(params: {
  prisma: PrismaClient;
  tenantId: string;
  status?: TenantStatus;
  suspensionReason?: string | null;
  logoUrl?: string | null;
  primaryColor?: string | null;
  accentColor?: string | null;
}) {
  const tenant = await params.prisma.tenant.findUnique({
    where: { id: params.tenantId },
  });

  if (!tenant) {
    throw new BookingError('Tenant not found.', 404, 'TENANT_REQUIRED');
  }

  const nextStatus = params.status ?? tenant.status;
  const updateData: Record<string, unknown> = {
    updatedAt: new Date(),
  };

  if (params.status !== undefined) {
    updateData.status = params.status;
    if (params.status === 'suspended') {
      updateData.suspendedAt = new Date();
      updateData.suspensionReason = params.suspensionReason?.trim() || tenant.suspensionReason || `${tenant.name} is temporarily suspended.`;
    } else {
      updateData.suspendedAt = null;
      updateData.suspensionReason = null;
    }
  }

  if (params.logoUrl !== undefined) {
    const nextLogoUrl = normalizeBrandLogoPath(params.logoUrl);
    updateData.logoUrl = nextLogoUrl || DEFAULT_BRAND_LOGO_PATH;
    updateData.logo = nextLogoUrl || DEFAULT_BRAND_LOGO_PATH;
  }
  if (params.primaryColor !== undefined) {
    updateData.primaryColor = params.primaryColor?.trim() || null;
  }
  if (params.accentColor !== undefined) {
    updateData.accentColor = params.accentColor?.trim() || null;
  }

  const updatedTenant = await params.prisma.tenant.update({
    where: { id: tenant.id },
    data: updateData,
  });

  const settings = await params.prisma.tenantSettings.findUnique({
    where: { tenantId: tenant.id },
  });

  if (settings) {
    const normalized = {
      ...settings,
      branding: {
        ...(settings.branding as Record<string, unknown>),
        displayName: updatedTenant.name,
        logoUrl: normalizeBrandLogoPath(updatedTenant.logoUrl || updatedTenant.logo),
        primaryColor:
          updatedTenant.primaryColor ||
          ((settings.branding as Record<string, unknown>).primaryColor as string | undefined) ||
          DEFAULT_PRIMARY_HEX,
        accentColor:
          updatedTenant.accentColor ||
          ((settings.branding as Record<string, unknown>).accentColor as string | undefined) ||
          DEFAULT_ACCENT_HEX,
      },
    };

    await params.prisma.tenantSettings.update({
      where: { tenantId: tenant.id },
      data: {
        branding: normalized.branding,
        updatedAt: new Date(),
      },
    });
  }

  return {
    tenant: updatedTenant,
    before: {
      status: tenant.status,
      suspendedAt: tenant.suspendedAt,
      suspensionReason: tenant.suspensionReason,
      logoUrl: tenant.logoUrl,
      primaryColor: tenant.primaryColor,
      accentColor: tenant.accentColor,
    },
    after: {
      status: updatedTenant.status,
      suspendedAt: updatedTenant.suspendedAt,
      suspensionReason: updatedTenant.suspensionReason,
      logoUrl: updatedTenant.logoUrl,
      primaryColor: updatedTenant.primaryColor,
      accentColor: updatedTenant.accentColor,
    },
    nextStatus,
  };
}

export async function listPlatformPassengersData(prisma: PrismaClient, filters?: PassengerDirectoryFilters) {
  const query = filters?.query?.trim();
  const passengers = await prisma.user.findMany({
    where: {
      role: 'passenger',
      ...(filters?.tenantId && filters.tenantId !== 'all' ? { tenantId: filters.tenantId } : {}),
      ...(query
        ? {
            OR: [
              { name: { contains: query, mode: 'insensitive' } },
              { phone: { contains: query, mode: 'insensitive' } },
              { email: { contains: query, mode: 'insensitive' } },
            ],
          }
        : {}),
    },
    include: {
      Tenant: {
        select: {
          id: true,
          name: true,
          status: true,
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  const passengerIds = passengers.map((passenger) => passenger.id);
  const [activeRideCounts, activeReservationCounts, lastRideDates, tenants] = passengerIds.length
    ? await Promise.all([
        prisma.ride.groupBy({
          by: ['passengerId'],
          where: {
            passengerId: { in: passengerIds },
            status: {
              in: ['searching', 'matched', 'en_route', 'arrived', 'in_trip'],
            },
          },
          _count: {
            passengerId: true,
          },
        }),
        prisma.reservation.groupBy({
          by: ['passengerId'],
          where: {
            passengerId: { in: passengerIds },
            status: {
              in: ['pending', 'confirmed', 'arrived'],
            },
          },
          _count: {
            passengerId: true,
          },
        }),
        prisma.ride.groupBy({
          by: ['passengerId'],
          where: {
            passengerId: { in: passengerIds },
          },
          _max: {
            createdAt: true,
          },
        }),
        prisma.tenant.findMany({
          orderBy: { name: 'asc' },
          select: {
            id: true,
            name: true,
            status: true,
          },
        }),
      ])
    : [[], [], [], []];

  const activeRideMap = new Map(activeRideCounts.map((item) => [item.passengerId, item._count.passengerId]));
  const activeReservationMap = new Map(
    activeReservationCounts.map((item) => [item.passengerId, item._count.passengerId])
  );
  const lastRideMap = new Map(lastRideDates.map((item) => [item.passengerId, item._max.createdAt ?? null]));

  const rows = passengers.map((passenger) => {
    const activeRideCount = activeRideMap.get(passenger.id) ?? 0;
    const activeReservationCount = activeReservationMap.get(passenger.id) ?? 0;
    return {
      id: passenger.id,
      name: passenger.name,
      phone: passenger.phone,
      email: passenger.email,
      createdAt: passenger.createdAt,
      rating: passenger.rating,
      completedRides: passenger.completedRides ?? 0,
      activeRideCount,
      activeReservationCount,
      lastRideAt: lastRideMap.get(passenger.id) ?? null,
      tenant: passenger.Tenant,
    };
  });

  const filteredRows = rows.filter((row) => {
    if (filters?.activity === 'active') {
      return row.activeRideCount > 0 || row.activeReservationCount > 0;
    }
    if (filters?.activity === 'inactive') {
      return row.activeRideCount === 0 && row.activeReservationCount === 0;
    }
    return true;
  });

  return {
    passengers: filteredRows,
    stats: {
      totalPassengers: rows.length,
      activePassengers: rows.filter((row) => row.activeRideCount > 0 || row.activeReservationCount > 0).length,
      filteredPassengers: filteredRows.length,
    },
    tenants,
  };
}

export async function getPlatformPassengerProfileData(prisma: PrismaClient, passengerId: string) {
  const passenger = await prisma.user.findFirst({
    where: {
      id: passengerId,
      role: 'passenger',
    },
    include: {
      Tenant: {
        select: {
          id: true,
          name: true,
          status: true,
          lguName: true,
        },
      },
    },
  });

  if (!passenger) {
    throw new BookingError('Passenger not found.', 404, 'PROFILE_NOT_FOUND');
  }

  const [activeRide, activeReservations, rides, reservations] = await Promise.all([
    prisma.ride.findFirst({
      where: {
        passengerId,
        status: {
          in: ['searching', 'matched', 'en_route', 'arrived', 'in_trip'],
        },
      },
      include: {
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
      orderBy: { createdAt: 'desc' },
    }),
    prisma.reservation.findMany({
      where: {
        passengerId,
        status: {
          in: ['pending', 'confirmed', 'arrived'],
        },
      },
      include: {
        TODATerminal: {
          select: {
            id: true,
            name: true,
            location: true,
          },
        },
      },
      orderBy: [{ status: 'asc' }, { queuePosition: 'asc' }, { createdAt: 'desc' }],
    }),
    prisma.ride.findMany({
      where: { passengerId },
      include: {
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
      orderBy: { createdAt: 'desc' },
    }),
    prisma.reservation.findMany({
      where: { passengerId },
      include: {
        TODATerminal: {
          select: {
            id: true,
            name: true,
            location: true,
          },
        },
      },
      orderBy: [{ createdAt: 'desc' }],
    }),
  ]);

  const completedRides = rides.filter((ride) => ride.status === 'completed');
  const cancelledRides = rides.filter((ride) => ride.status === 'cancelled');

  return {
    passenger: {
      id: passenger.id,
      name: passenger.name,
      phone: passenger.phone,
      phoneE164: passenger.phoneE164,
      email: passenger.email,
      emergencyContactName: passenger.emergencyContactName,
      emergencyContactPhone: passenger.emergencyContactPhone,
      termsAcceptedAt: passenger.termsAcceptedAt,
      createdAt: passenger.createdAt,
      rating: passenger.rating,
      completedRides: passenger.completedRides ?? 0,
      balance: passenger.balance ?? 0,
      tenant: passenger.Tenant,
    },
    activeRide: activeRide
      ? {
          ...activeRide,
          driver: activeRide.User_Ride_driverIdToUser,
          terminal: activeRide.TODATerminal,
        }
      : null,
    activeReservations: activeReservations.map(({ TODATerminal, ...reservation }) => ({
      ...reservation,
      terminal: TODATerminal,
    })),
    rides: rides.map(({ User_Ride_driverIdToUser, TODATerminal, ...ride }) => ({
      ...ride,
      driver: User_Ride_driverIdToUser,
      terminal: TODATerminal,
    })),
    reservations: reservations.map(({ TODATerminal, ...reservation }) => ({
      ...reservation,
      terminal: TODATerminal,
    })),
    stats: {
      totalRides: rides.length,
      completedRides: completedRides.length,
      cancelledRides: cancelledRides.length,
      totalReservations: reservations.length,
      totalSpent: completedRides.reduce((sum, ride) => sum + ride.fare, 0),
    },
  };
}

export async function updatePlatformPassengerProfile(params: {
  prisma: PrismaClient;
  passengerId: string;
  input: {
    name?: string;
    email?: string | null;
    emergencyContactName?: string | null;
    emergencyContactPhone?: string | null;
  };
}) {
  const passenger = await params.prisma.user.findFirst({
    where: {
      id: params.passengerId,
      role: 'passenger',
    },
  });

  if (!passenger) {
    throw new BookingError('Passenger not found.', 404, 'PROFILE_NOT_FOUND');
  }

  const updatedPassenger = await params.prisma.user.update({
    where: { id: passenger.id },
    data: {
      ...(params.input.name !== undefined ? { name: params.input.name.trim() } : {}),
      ...(params.input.email !== undefined ? { email: params.input.email?.trim() ? params.input.email.trim() : null } : {}),
      ...(params.input.emergencyContactName !== undefined
        ? {
            emergencyContactName: params.input.emergencyContactName?.trim()
              ? params.input.emergencyContactName.trim()
              : null,
          }
        : {}),
      ...(params.input.emergencyContactPhone !== undefined
        ? {
            emergencyContactPhone: params.input.emergencyContactPhone?.trim()
              ? params.input.emergencyContactPhone.trim()
              : null,
          }
        : {}),
      updatedAt: new Date(),
    },
  });

  return {
    passenger: updatedPassenger,
    before: {
      name: passenger.name,
      email: passenger.email,
      emergencyContactName: passenger.emergencyContactName,
      emergencyContactPhone: passenger.emergencyContactPhone,
    },
    after: {
      name: updatedPassenger.name,
      email: updatedPassenger.email,
      emergencyContactName: updatedPassenger.emergencyContactName,
      emergencyContactPhone: updatedPassenger.emergencyContactPhone,
    },
  };
}

export async function listPlatformAuditData(
  prisma: PrismaClient,
  filters?: {
    tenantId?: string;
    module?: string;
    action?: string;
  }
) {
  const logs = await prisma.platformAuditLog.findMany({
    where: {
      ...(filters?.tenantId && filters.tenantId !== 'all' ? { tenantId: filters.tenantId } : {}),
      ...(filters?.module && filters.module !== 'all' ? { module: filters.module } : {}),
      ...(filters?.action && filters.action !== 'all' ? { action: filters.action } : {}),
    },
    include: {
      ActorUser: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
      Tenant: {
        select: {
          id: true,
          name: true,
          lguName: true,
        },
      },
    },
    orderBy: { createdAt: 'desc' },
    take: 200,
  });

  const tenants = await prisma.tenant.findMany({
    select: {
      id: true,
      name: true,
      lguName: true,
    },
    orderBy: { name: 'asc' },
  });

  return {
    logs: logs.map((log) => ({
      id: log.id,
      module: log.module,
      action: log.action,
      targetType: log.targetType,
      targetId: log.targetId,
      reason: log.reason,
      beforeJson: log.beforeJson,
      afterJson: log.afterJson,
      createdAt: log.createdAt,
      actor: log.ActorUser,
      tenant: log.Tenant,
    })),
    tenants,
  };
}
