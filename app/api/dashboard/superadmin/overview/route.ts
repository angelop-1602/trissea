import { NextRequest } from 'next/server';
import { getPrisma } from '@/lib/prisma';
import { requireBookingProfile, toBookingActor } from '@/lib/booking/auth';
import { bookingError, bookingErrorResponse, bookingSuccess, getRequestIdFromHeaders } from '@/lib/booking/http';

export async function GET(request: NextRequest) {
  const requestId = getRequestIdFromHeaders(request.headers);

  try {
    const user = await requireBookingProfile(request);
    const actor = toBookingActor(user);

    if (actor.role !== 'superadmin') {
      return bookingError(requestId, 'Only superadmins can access this endpoint.', 403, 'FORBIDDEN_ROLE');
    }

    const prisma = getPrisma();

    const [tenants, users, rides, terminals] = await Promise.all([
      prisma.tenant.findMany({ orderBy: { name: 'asc' } }),
      prisma.user.findMany({}),
      prisma.ride.findMany({}),
      prisma.tODATerminal.findMany({}),
    ]);

    const activeRides = rides.filter((ride: (typeof rides)[number]) =>
      ['matched', 'en_route', 'arrived', 'in_trip'].includes(ride.status)
    );

    const totalCoverageProvinces = new Set(
      tenants.map((tenant: (typeof tenants)[number]) => tenant.provinceCode)
    ).size;

    const platformMapPoints = [
      ...terminals.map((terminal: (typeof terminals)[number]) => ({
        id: `terminal-${terminal.id}`,
        label: terminal.name,
        description:
          tenants.find((tenant: (typeof tenants)[number]) => tenant.id === terminal.tenantId)?.name ??
          'Unknown Tenant',
        latitude: terminal.latitude,
        longitude: terminal.longitude,
        tone: 'terminal' as const,
      })),
      ...activeRides.map((ride: (typeof activeRides)[number]) => ({
        id: `ride-${ride.id}`,
        label: `Active Ride ${ride.id}`,
        description:
          tenants.find((tenant: (typeof tenants)[number]) => tenant.id === ride.tenantId)?.name ??
          'Unknown Tenant',
        latitude: ride.driverLatitude ?? ride.pickupLatitude,
        longitude: ride.driverLongitude ?? ride.pickupLongitude,
        tone: ride.driverLatitude && ride.driverLongitude ? ('driver' as const) : ('ride' as const),
      })),
    ];

    return bookingSuccess(requestId, {
      stats: {
        totalCoverageProvinces,
        totalTenants: tenants.length,
        totalUsers: users.length,
        totalRides: rides.length,
      },
      platformMapPoints,
    });
  } catch (error) {
    return bookingErrorResponse(error, requestId);
  }
}
