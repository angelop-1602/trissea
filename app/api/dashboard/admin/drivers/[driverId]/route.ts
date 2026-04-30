import { NextRequest } from 'next/server';
import { ACTIVE_ON_DEMAND_DRIVER_STATUSES } from '@/lib/booking/types';
import { requireActorTenantId, requireBookingProfile, toBookingActor } from '@/lib/booking/auth';
import { bookingError, bookingErrorResponse, bookingSuccess, getRequestIdFromHeaders } from '@/lib/booking/http';
import { computeDriverTripAnalytics } from '@/lib/dashboard/driver-profile';
import { ensureTenantDriverProfiles } from '@/lib/driver-domain';
import { getPrisma } from '@/lib/prisma';

interface Params {
  params: Promise<{ driverId: string }>;
}

const RECENT_RIDES_LIMIT = 30;

export async function GET(request: NextRequest, { params }: Params) {
  const requestId = getRequestIdFromHeaders(request.headers);

  try {
    const { driverId } = await params;
    const user = await requireBookingProfile(request);
    const actor = toBookingActor(user);

    if (actor.role !== 'admin') {
      return bookingError(requestId, 'Only admins can access this endpoint.', 403, 'FORBIDDEN_ROLE');
    }
    const tenantId = requireActorTenantId(actor);

    const prisma = getPrisma();
    await ensureTenantDriverProfiles(prisma, tenantId);
    const driverProfile = await prisma.driverProfile.findFirst({
      where: {
        tenantId,
        userId: driverId,
      },
      include: {
        User: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            avatar: true,
            createdAt: true,
            rating: true,
            completedRides: true,
          },
        },
        TODATerminal: {
          select: {
            id: true,
            name: true,
            location: true,
          },
        },
        DriverDocuments: {
          include: {
            ReviewedByUser: {
              select: {
                id: true,
                name: true,
              },
            },
          },
          orderBy: [{ submittedAt: 'desc' }, { createdAt: 'desc' }],
        },
      },
    });

    if (!driverProfile) {
      return bookingError(requestId, 'Driver not found.', 404, 'PROFILE_NOT_FOUND');
    }

    const driver = driverProfile.User;

    const [presence, activeRide, analyticsRides, recentRides] = await Promise.all([
      prisma.driverPresence.findUnique({
        where: { driverId: driver.id },
        select: {
          isOnline: true,
          onlineSinceAt: true,
          lastHeartbeatAt: true,
        },
      }),
      prisma.ride.findFirst({
        where: {
          tenantId,
          driverId: driver.id,
          status: {
            in: ACTIVE_ON_DEMAND_DRIVER_STATUSES,
          },
        },
        include: {
          User_Ride_passengerIdToUser: {
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
      prisma.ride.findMany({
        where: {
          tenantId,
          driverId: driver.id,
        },
        select: {
          status: true,
          fare: true,
        },
      }),
      prisma.ride.findMany({
        where: {
          tenantId,
          driverId: driver.id,
        },
        include: {
          User_Ride_passengerIdToUser: {
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
        take: RECENT_RIDES_LIMIT,
      }),
    ]);

    const stats = computeDriverTripAnalytics(analyticsRides);

    return bookingSuccess(requestId, {
      driver: {
        id: driver.id,
        driverProfileId: driverProfile.id,
        name: driverProfile.legalFullName ?? driver.name,
        email: driverProfile.contactEmail ?? driver.email,
        phone: driverProfile.contactPhone ?? driver.phone,
        avatar: driver.avatar,
        createdAt: driver.createdAt,
        rating: driver.rating,
        completedRides: driver.completedRides,
        toda: driverProfile.TODATerminal,
        verificationStatus: driverProfile.verificationStatus,
        restrictionStatus: driverProfile.restrictionStatus,
        legalFullName: driverProfile.legalFullName,
        dateOfBirth: driverProfile.dateOfBirth,
        homeAddress: driverProfile.homeAddress,
        todaMembershipId: driverProfile.todaMembershipId,
        licenseNumber: driverProfile.licenseNumber,
        licenseExpiry: driverProfile.licenseExpiry,
        vehicleType: driverProfile.vehicleType,
        plateNumber: driverProfile.plateNumber,
        vehicleModel: driverProfile.vehicleModel,
        vehicleColor: driverProfile.vehicleColor,
        isDriverVerified: driverProfile.verificationStatus === 'verified',
        isDriverRestricted: driverProfile.restrictionStatus === 'restricted',
        driverRestrictionReason: driverProfile.currentRestrictionReason,
        driverRestrictedAt: driverProfile.restrictedAt,
      },
      presence: {
        isOnline: presence?.isOnline ?? false,
        onlineSinceAt: presence?.onlineSinceAt ?? null,
        lastHeartbeatAt: presence?.lastHeartbeatAt ?? null,
      },
      activeRide: activeRide
        ? {
            ...activeRide,
            passenger: activeRide.User_Ride_passengerIdToUser,
            terminal: activeRide.TODATerminal,
          }
        : null,
      recentRides: recentRides.map(({ User_Ride_passengerIdToUser, TODATerminal, ...ride }) => ({
        ...ride,
        passenger: User_Ride_passengerIdToUser,
        terminal: TODATerminal,
      })),
      stats,
      documents: driverProfile.DriverDocuments.map((document) => ({
        id: document.id,
        documentType: document.documentType,
        fileUrl: document.fileUrl,
        storageRef: document.storageRef,
        reviewStatus: document.reviewStatus,
        metadata: document.metadata,
        submittedAt: document.submittedAt,
        reviewedAt: document.reviewedAt,
        reviewedBy: document.ReviewedByUser,
        remarks: document.remarks,
      })),
    });
  } catch (error) {
    return bookingErrorResponse(error, requestId);
  }
}
