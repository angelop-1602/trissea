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
    const [rides, tenants] = await Promise.all([
      prisma.ride.findMany({}),
      prisma.tenant.findMany({}),
    ]);

    const totalRevenue = rides.reduce((sum, ride) => sum + ride.fare, 0);
    const totalCommission = totalRevenue * 0.1;
    const averagePerRide = rides.length === 0 ? 0 : totalRevenue / rides.length;

    const tenantPerformance = tenants.map((tenant) => {
      const tenantRides = rides.filter((ride) => ride.tenantId === tenant.id);
      const revenue = tenantRides.reduce((sum, ride) => sum + (ride.status === 'completed' ? ride.fare : 0), 0);
      return {
        id: tenant.id,
        name: tenant.name,
        rides: tenantRides.length,
        revenue,
      };
    });

    return bookingSuccess(requestId, {
      stats: {
        totalRides: rides.length,
        totalRevenue,
        totalCommission,
        averagePerRide,
      },
      tenantPerformance,
    });
  } catch (error) {
    return bookingErrorResponse(error, requestId);
  }
}
