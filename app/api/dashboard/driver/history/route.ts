import { NextRequest } from 'next/server';
import { getPrisma } from '@/lib/prisma';
import { requireActorTenantId, requireBookingProfile, toBookingActor } from '@/lib/booking/auth';
import { bookingError, bookingErrorResponse, bookingSuccess, getRequestIdFromHeaders } from '@/lib/booking/http';

export async function GET(request: NextRequest) {
  const requestId = getRequestIdFromHeaders(request.headers);

  try {
    const user = await requireBookingProfile(request);
    const actor = toBookingActor(user);
    if (actor.role !== 'driver') {
      return bookingError(requestId, 'Only drivers can access this endpoint.', 403, 'FORBIDDEN_ROLE');
    }
    const tenantId = requireActorTenantId(actor);

    const prisma = getPrisma();
    const rides = await prisma.ride.findMany({
      where: {
        tenantId,
        driverId: actor.id,
      },
      orderBy: { createdAt: 'desc' },
      include: {
        User_Ride_passengerIdToUser: {
          select: {
            id: true,
            name: true,
            rating: true,
          },
        },
        Feedback: {
          where: {
            reviewerUserId: actor.id,
          },
          select: {
            id: true,
            reviewerUserId: true,
            subjectUserId: true,
            rating: true,
            note: true,
            createdAt: true,
            updatedAt: true,
          },
          take: 1,
        },
      },
    });

    const completedRides = rides.filter((ride) => ride.status === 'completed');
    const cancelledRides = rides.filter((ride) => ride.status === 'cancelled');
    const totalEarnings = completedRides.reduce((sum, ride) => sum + ride.fare, 0);

    return bookingSuccess(requestId, {
      rides: rides.map((ride) => {
        const { User_Ride_passengerIdToUser, Feedback, ...rideData } = ride;
        return {
          ...rideData,
          passenger: User_Ride_passengerIdToUser,
          viewerFeedback: Feedback[0] ?? null,
        };
      }),
      stats: {
        totalRides: rides.length,
        completedRides: completedRides.length,
        cancelledRides: cancelledRides.length,
        totalEarnings,
      },
    });
  } catch (error) {
    return bookingErrorResponse(error, requestId);
  }
}
