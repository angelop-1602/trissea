import { NextRequest } from 'next/server';
import { getPrisma } from '@/lib/prisma';
import { requireBookingProfile, toBookingActor } from '@/lib/booking/auth';
import { bookingError, bookingErrorResponse, bookingSuccess, getRequestIdFromHeaders } from '@/lib/booking/http';

export async function GET(request: NextRequest) {
  const requestId = getRequestIdFromHeaders(request.headers);

  try {
    const user = await requireBookingProfile(request);
    const actor = toBookingActor(user);
    if (actor.role !== 'passenger') {
      return bookingError(requestId, 'Only passengers can access this endpoint.', 403, 'FORBIDDEN_ROLE');
    }

    const prisma = getPrisma();
    const rides = await prisma.ride.findMany({
      where: {
        passengerId: actor.id,
      },
      orderBy: { createdAt: 'desc' },
      include: {
        User_Ride_driverIdToUser: {
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

    const completedOrCancelled = rides.filter(
      (ride) => ride.status === 'completed' || ride.status === 'cancelled'
    );

    const totalSpent = completedOrCancelled.reduce((sum, ride) => sum + ride.fare, 0);

    return bookingSuccess(requestId, {
      rides: rides.map((ride) => {
        const { User_Ride_driverIdToUser, Feedback, ...rideData } = ride;
        return {
          ...rideData,
          driver: User_Ride_driverIdToUser,
          viewerFeedback: Feedback[0] ?? null,
        };
      }),
      stats: {
        totalRides: rides.length,
        totalSpent,
        averageRating: user.rating ?? 0,
      },
    });
  } catch (error) {
    return bookingErrorResponse(error, requestId);
  }
}
