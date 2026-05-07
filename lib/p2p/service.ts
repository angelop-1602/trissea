import { randomUUID } from 'node:crypto';
import {
  Prisma,
  type P2PCorridor,
  type P2PDeparture,
  type P2PDepartureStatus,
  type P2PReservation,
  type P2PReservationStatus,
  type PrismaClient,
} from '@prisma/client';
import { getPrisma } from '@/lib/prisma';
import { BookingError } from '@/lib/booking/errors';
import { emitBookingEvent } from '@/lib/booking/events';
import { requireActorTenantId } from '@/lib/booking/auth';
import type { BookingActor } from '@/lib/booking/types';
import type {
  AdminP2POverview,
  DriverP2PDashboard,
  P2PCorridorInput,
  P2PCorridorSummary,
  P2PDepartureAction,
  P2PDepartureInput,
  P2PDepartureSummary,
  P2PReservationAction,
  P2PReservationInput,
  P2PReservationSummary,
  PassengerP2PDashboard,
} from '@/lib/p2p/types';

type PrismaDbClient = Prisma.TransactionClient | ReturnType<typeof getPrisma>;
type CorridorRecord = P2PCorridor & {
  Departures?: DepartureRecord[];
};
type DepartureRecord = P2PDeparture & {
  Corridor: P2PCorridor;
  Driver: { id: string; name: string } | null;
  Reservations?: ReservationRecord[];
};
type ReservationRecord = P2PReservation & {
  Departure: DepartureRecord;
  Passenger: { id: string; name: string; phone: string | null } | null;
};

const DRIVER_ACTIVE_DEPARTURE_STATUSES: P2PDepartureStatus[] = ['scheduled', 'boarding', 'departed'];

function isPassengerActiveReservationStatus(status: P2PReservationStatus) {
  return status === 'confirmed' || status === 'boarded';
}

function assertTenantScope(recordTenantId: string, actorTenantId: string) {
  if (recordTenantId !== actorTenantId) {
    throw new BookingError('Cross-tenant access is not allowed.', 403, 'TENANT_SCOPE_VIOLATION');
  }
}

function assertRole(actor: BookingActor, expected: 'passenger' | 'driver' | 'admin') {
  if (actor.role !== expected) {
    throw new BookingError('Forbidden for this role.', 403, 'FORBIDDEN_ROLE');
  }
}

function normalizeOptionalString(value?: string | null) {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

function toIso(value: Date | null | undefined) {
  return value ? value.toISOString() : null;
}

function buildBookingReference() {
  return `P2P-${Math.random().toString(36).slice(2, 6).toUpperCase()}-${Date.now().toString(36).slice(-4).toUpperCase()}`;
}

function emitCorridorEvent(corridor: P2PCorridor) {
  emitBookingEvent({
    type: 'p2p.corridor.updated',
    tenantId: corridor.tenantId,
    entityId: corridor.id,
    payload: corridor,
  });
}

function emitDepartureEvent(departure: P2PDeparture) {
  emitBookingEvent({
    type: 'p2p.departure.updated',
    tenantId: departure.tenantId,
    entityId: departure.id,
    payload: departure,
  });
}

function emitReservationEvent(reservation: P2PReservation) {
  emitBookingEvent({
    type: 'p2p.reservation.updated',
    tenantId: reservation.tenantId,
    entityId: reservation.id,
    payload: reservation,
  });
}

function formatDepartureSummary(record: DepartureRecord): P2PDepartureSummary {
  return {
    id: record.id,
    tenantId: record.tenantId,
    corridorId: record.corridorId,
    corridorCode: record.Corridor.code,
    corridorName: record.Corridor.name,
    corridorSummary: record.Corridor.summary ?? null,
    originLabel: record.Corridor.originLabel,
    destinationLabel: record.Corridor.destinationLabel,
    distanceKm: record.Corridor.distanceKm,
    estimatedDuration: record.Corridor.estimatedDuration,
    baseFare: record.Corridor.baseFare,
    departureTime: record.departureTime.toISOString(),
    status: record.status,
    boardingBay: record.boardingBay,
    seatCapacity: record.seatCapacity,
    availableSeats: record.availableSeats,
    vehicleLabel: record.vehicleLabel ?? null,
    driver: record.Driver
      ? {
          id: record.Driver.id,
          name: record.Driver.name,
        }
      : null,
  };
}

function formatReservationSummary(record: ReservationRecord): P2PReservationSummary {
  return {
    id: record.id,
    tenantId: record.tenantId,
    departureId: record.departureId,
    bookingReference: record.bookingReference,
    seatCount: record.seatCount,
    fareTotal: record.fareTotal,
    status: record.status,
    createdAt: record.createdAt.toISOString(),
    boardedAt: toIso(record.boardedAt),
    completedAt: toIso(record.completedAt),
    cancelledAt: toIso(record.cancelledAt),
    passenger: record.Passenger
      ? {
          id: record.Passenger.id,
          name: record.Passenger.name,
          phone: record.Passenger.phone,
        }
      : null,
    departure: formatDepartureSummary(record.Departure),
  };
}

function formatCorridorSummary(record: CorridorRecord, nextDeparture: DepartureRecord | null): P2PCorridorSummary {
  return {
    id: record.id,
    tenantId: record.tenantId,
    code: record.code,
    name: record.name,
    summary: record.summary ?? null,
    originLabel: record.originLabel,
    destinationLabel: record.destinationLabel,
    distanceKm: record.distanceKm,
    estimatedDuration: record.estimatedDuration,
    baseFare: record.baseFare,
    isActive: record.isActive,
    nextDeparture: nextDeparture ? formatDepartureSummary(nextDeparture) : null,
  };
}

async function findCorridorOrThrow(prisma: PrismaDbClient, corridorId: string) {
  const corridor = await prisma.p2PCorridor.findUnique({
    where: { id: corridorId },
  });

  if (!corridor) {
    throw new BookingError('P2P corridor not found.', 404, 'TERMINAL_NOT_FOUND');
  }

  return corridor;
}

async function findDepartureOrThrow(prisma: PrismaDbClient, departureId: string) {
  const departure = await prisma.p2PDeparture.findUnique({
    where: { id: departureId },
    include: {
      Corridor: true,
      Driver: {
        select: {
          id: true,
          name: true,
        },
      },
      Reservations: {
        include: {
          Passenger: {
            select: {
              id: true,
              name: true,
              phone: true,
            },
          },
          Departure: {
            include: {
              Corridor: true,
              Driver: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
          },
        },
        orderBy: {
          createdAt: 'asc',
        },
      },
    },
  });

  if (!departure) {
    throw new BookingError('P2P departure not found.', 404, 'TERMINAL_NOT_FOUND');
  }

  return departure as DepartureRecord;
}

async function findReservationOrThrow(prisma: PrismaDbClient, reservationId: string) {
  const reservation = await prisma.p2PReservation.findUnique({
    where: { id: reservationId },
    include: {
      Passenger: {
        select: {
          id: true,
          name: true,
          phone: true,
        },
      },
      Departure: {
        include: {
          Corridor: true,
          Driver: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      },
    },
  });

  if (!reservation) {
    throw new BookingError('P2P reservation not found.', 404, 'RESERVATION_NOT_FOUND');
  }

  return reservation as ReservationRecord;
}

function assertDriverCanOperateDeparture(actor: BookingActor, departure: DepartureRecord, tenantId: string) {
  assertTenantScope(departure.tenantId, tenantId);

  if (actor.role === 'driver' && departure.driverId !== actor.id) {
    throw new BookingError('Only the assigned driver can operate this departure.', 403, 'NOT_ASSIGNED_DRIVER');
  }
}

export async function createP2PCorridor(actor: BookingActor, input: P2PCorridorInput) {
  assertRole(actor, 'admin');
  const tenantId = requireActorTenantId(actor);
  const prisma = getPrisma();

  const corridor = await prisma.p2PCorridor.create({
    data: {
      id: randomUUID(),
      tenantId,
      code: input.code.trim().toUpperCase(),
      name: input.name.trim(),
      summary: normalizeOptionalString(input.summary),
      originLabel: input.originLabel.trim(),
      originLatitude: input.origin.latitude,
      originLongitude: input.origin.longitude,
      destinationLabel: input.destinationLabel.trim(),
      destinationLatitude: input.destination.latitude,
      destinationLongitude: input.destination.longitude,
      distanceKm: Number(input.distanceKm.toFixed(2)),
      estimatedDuration: input.estimatedDuration,
      baseFare: Number(input.baseFare.toFixed(2)),
      isActive: true,
    },
  });

  emitCorridorEvent(corridor);
  return formatCorridorSummary(corridor, null);
}

export async function createP2PDeparture(actor: BookingActor, input: P2PDepartureInput) {
  assertRole(actor, 'admin');
  const tenantId = requireActorTenantId(actor);
  const prisma = getPrisma();

  const corridor = await findCorridorOrThrow(prisma, input.corridorId);
  assertTenantScope(corridor.tenantId, tenantId);

  if (input.driverId) {
    const driver = await prisma.user.findUnique({
      where: { id: input.driverId },
      select: {
        id: true,
        role: true,
        tenantId: true,
      },
    });

    if (!driver || driver.role !== 'driver' || driver.tenantId !== tenantId) {
      throw new BookingError('Assigned driver is invalid for this tenant.', 400, 'INVALID_ACTION');
    }
  }

  const departure = await prisma.p2PDeparture.create({
    data: {
      id: randomUUID(),
      tenantId,
      corridorId: corridor.id,
      driverId: normalizeOptionalString(input.driverId) ?? undefined,
      vehicleLabel: normalizeOptionalString(input.vehicleLabel),
      boardingBay: input.boardingBay.trim(),
      seatCapacity: input.seatCapacity,
      availableSeats: input.seatCapacity,
      departureTime: new Date(input.departureTime),
      status: 'scheduled',
    },
    include: {
      Corridor: true,
      Driver: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  });

  emitDepartureEvent(departure);
  return formatDepartureSummary(departure as DepartureRecord);
}

export async function getPassengerP2PDashboard(actor: BookingActor): Promise<PassengerP2PDashboard> {
  assertRole(actor, 'passenger');
  const tenantId = requireActorTenantId(actor);
  const prisma = getPrisma();
  const now = new Date();

  const [corridors, departures, reservations] = await Promise.all([
    prisma.p2PCorridor.findMany({
      where: {
        tenantId,
        isActive: true,
      },
      orderBy: [{ name: 'asc' }],
    }),
    prisma.p2PDeparture.findMany({
      where: {
        tenantId,
        status: { in: ['scheduled', 'boarding'] },
        departureTime: { gte: now },
      },
      include: {
        Corridor: true,
        Driver: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: [{ departureTime: 'asc' }],
      take: 12,
    }),
    prisma.p2PReservation.findMany({
      where: {
        tenantId,
        passengerId: actor.id,
      },
      include: {
        Passenger: {
          select: {
            id: true,
            name: true,
            phone: true,
          },
        },
        Departure: {
          include: {
            Corridor: true,
            Driver: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
      orderBy: [{ createdAt: 'desc' }],
      take: 10,
    }),
  ]);

  const nextDepartureByCorridor = new Map<string, DepartureRecord>();
  departures.forEach((departure) => {
    if (!nextDepartureByCorridor.has(departure.corridorId)) {
      nextDepartureByCorridor.set(departure.corridorId, departure as DepartureRecord);
    }
  });

  const corridorSummaries = corridors.map((corridor) =>
    formatCorridorSummary(corridor, nextDepartureByCorridor.get(corridor.id) ?? null)
  );

  const reservationSummaries = reservations.map((reservation) => formatReservationSummary(reservation as ReservationRecord));

  return {
    corridors: corridorSummaries,
    upcomingDepartures: departures.map((departure) => formatDepartureSummary(departure as DepartureRecord)),
    activeReservations: reservationSummaries.filter((reservation) => isPassengerActiveReservationStatus(reservation.status)),
    recentReservations: reservationSummaries,
  };
}

export async function createP2PReservation(actor: BookingActor, input: P2PReservationInput) {
  assertRole(actor, 'passenger');
  const tenantId = requireActorTenantId(actor);
  const prisma = getPrisma();

  return prisma.$transaction(async (tx) => {
    const departure = await findDepartureOrThrow(tx, input.departureId);
    assertTenantScope(departure.tenantId, tenantId);

    if (!['scheduled', 'boarding'].includes(departure.status)) {
      throw new BookingError('This departure is no longer accepting reservations.', 409, 'INVALID_RESERVATION_STATUS');
    }

    const existingReservation = await tx.p2PReservation.findFirst({
      where: {
        departureId: departure.id,
        passengerId: actor.id,
      },
      include: {
        Passenger: {
          select: {
            id: true,
            name: true,
            phone: true,
          },
        },
        Departure: {
          include: {
            Corridor: true,
            Driver: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
    });

    if (existingReservation && isPassengerActiveReservationStatus(existingReservation.status)) {
      return formatReservationSummary(existingReservation as ReservationRecord);
    }

    if (existingReservation) {
      throw new BookingError('You already have a closed reservation for this departure.', 409, 'INVALID_ACTION');
    }

    if (departure.availableSeats < input.seatCount) {
      throw new BookingError('Not enough seats are available on this departure.', 409, 'INVALID_ACTION');
    }

    const updatedDeparture = await tx.p2PDeparture.update({
      where: { id: departure.id },
      data: {
        availableSeats: {
          decrement: input.seatCount,
        },
      },
      include: {
        Corridor: true,
        Driver: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    const reservation = await tx.p2PReservation.create({
      data: {
        id: randomUUID(),
        tenantId,
        departureId: departure.id,
        passengerId: actor.id,
        seatCount: input.seatCount,
        fareTotal: Number((updatedDeparture.Corridor.baseFare * input.seatCount).toFixed(2)),
        bookingReference: buildBookingReference(),
        status: 'confirmed',
      },
      include: {
        Passenger: {
          select: {
            id: true,
            name: true,
            phone: true,
          },
        },
        Departure: {
          include: {
            Corridor: true,
            Driver: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
    });

    emitDepartureEvent(updatedDeparture);
    emitReservationEvent(reservation);
    return formatReservationSummary(reservation as ReservationRecord);
  });
}

export async function cancelP2PReservationByPassenger(actor: BookingActor, reservationId: string) {
  assertRole(actor, 'passenger');
  const tenantId = requireActorTenantId(actor);
  const prisma = getPrisma();

  return prisma.$transaction(async (tx) => {
    const reservation = await findReservationOrThrow(tx, reservationId);
    assertTenantScope(reservation.tenantId, tenantId);

    if (reservation.passengerId !== actor.id) {
      throw new BookingError('Only the reservation owner can cancel this booking.', 403, 'NOT_RESERVATION_OWNER');
    }

    if (reservation.status !== 'confirmed') {
      throw new BookingError('Only confirmed reservations can be cancelled.', 409, 'INVALID_RESERVATION_STATUS');
    }

    const updatedReservation = await tx.p2PReservation.update({
      where: { id: reservation.id },
      data: {
        status: 'cancelled',
        cancelledAt: new Date(),
      },
      include: {
        Passenger: {
          select: {
            id: true,
            name: true,
            phone: true,
          },
        },
        Departure: {
          include: {
            Corridor: true,
            Driver: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
    });

    const updatedDeparture = await tx.p2PDeparture.update({
      where: { id: reservation.departureId },
      data: {
        availableSeats: {
          increment: reservation.seatCount,
        },
      },
    });

    emitReservationEvent(updatedReservation);
    emitDepartureEvent(updatedDeparture);
    return formatReservationSummary(updatedReservation as ReservationRecord);
  });
}

export async function getDriverP2PDashboard(actor: BookingActor): Promise<DriverP2PDashboard> {
  assertRole(actor, 'driver');
  const tenantId = requireActorTenantId(actor);
  const prisma = getPrisma();

  const departures = await prisma.p2PDeparture.findMany({
    where: {
      tenantId,
      driverId: actor.id,
      status: { in: DRIVER_ACTIVE_DEPARTURE_STATUSES },
    },
    include: {
      Corridor: true,
      Driver: {
        select: {
          id: true,
          name: true,
        },
      },
      Reservations: {
        include: {
          Passenger: {
            select: {
              id: true,
              name: true,
              phone: true,
            },
          },
          Departure: {
            include: {
              Corridor: true,
              Driver: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
          },
        },
        orderBy: [{ createdAt: 'asc' }],
      },
    },
    orderBy: [{ departureTime: 'asc' }],
  });

  return {
    departures: departures.map((departure) => {
      const typedDeparture = departure as DepartureRecord;

      return {
        ...formatDepartureSummary(typedDeparture),
        reservations: (typedDeparture.Reservations ?? []).map((reservation) =>
          formatReservationSummary(reservation as ReservationRecord)
        ),
      };
    }),
  };
}

export async function transitionP2PDeparture(actor: BookingActor, departureId: string, action: P2PDepartureAction) {
  if (actor.role !== 'driver' && actor.role !== 'admin') {
    throw new BookingError('Only drivers and admins can update departures.', 403, 'FORBIDDEN_ROLE');
  }

  const tenantId = requireActorTenantId(actor);
  const prisma = getPrisma();

  return prisma.$transaction(async (tx) => {
    const departure = await findDepartureOrThrow(tx, departureId);
    assertDriverCanOperateDeparture(actor, departure, tenantId);

    let data: Prisma.P2PDepartureUpdateInput;

    switch (action) {
      case 'open_boarding':
        if (departure.status !== 'scheduled') {
          throw new BookingError('Boarding can only open from the scheduled state.', 409, 'INVALID_TRANSITION');
        }
        data = {
          status: 'boarding',
          boardingStartedAt: departure.boardingStartedAt ?? new Date(),
        };
        break;
      case 'depart':
        if (!['scheduled', 'boarding'].includes(departure.status)) {
          throw new BookingError('This departure cannot be marked as departed.', 409, 'INVALID_TRANSITION');
        }
        data = {
          status: 'departed',
          boardingStartedAt: departure.boardingStartedAt ?? new Date(),
          departedAt: departure.departedAt ?? new Date(),
        };
        break;
      case 'complete':
        if (departure.status !== 'departed') {
          throw new BookingError('Only departed trips can be completed.', 409, 'INVALID_TRANSITION');
        }
        data = {
          status: 'completed',
          completedAt: new Date(),
        };
        break;
      case 'cancel':
        if (!['scheduled', 'boarding'].includes(departure.status)) {
          throw new BookingError('Only scheduled or boarding trips can be cancelled.', 409, 'INVALID_TRANSITION');
        }
        data = {
          status: 'cancelled',
        };
        break;
      default:
        throw new BookingError('Unsupported departure action.', 400, 'INVALID_ACTION');
    }

    const updatedDeparture = await tx.p2PDeparture.update({
      where: { id: departure.id },
      data,
      include: {
        Corridor: true,
        Driver: {
          select: {
            id: true,
            name: true,
          },
        },
        Reservations: {
          include: {
            Passenger: {
              select: {
                id: true,
                name: true,
                phone: true,
              },
            },
            Departure: {
              include: {
                Corridor: true,
                Driver: {
                  select: {
                    id: true,
                    name: true,
                  },
                },
              },
            },
          },
          orderBy: [{ createdAt: 'asc' }],
        },
      },
    });

    if (action === 'complete') {
      const toComplete = updatedDeparture.Reservations.filter((reservation) => reservation.status === 'boarded');
      const toNoShow = updatedDeparture.Reservations.filter((reservation) => reservation.status === 'confirmed');

      for (const reservation of toComplete) {
        const completedReservation = await tx.p2PReservation.update({
          where: { id: reservation.id },
          data: {
            status: 'completed',
            completedAt: new Date(),
          },
        });
        emitReservationEvent(completedReservation);
      }

      for (const reservation of toNoShow) {
        const missedReservation = await tx.p2PReservation.update({
          where: { id: reservation.id },
          data: {
            status: 'no_show',
          },
        });
        emitReservationEvent(missedReservation);
      }
    }

    if (action === 'cancel') {
      for (const reservation of updatedDeparture.Reservations.filter((reservation) =>
        reservation.status === 'confirmed' || reservation.status === 'boarded'
      )) {
        const cancelledReservation = await tx.p2PReservation.update({
          where: { id: reservation.id },
          data: {
            status: 'cancelled',
            cancelledAt: new Date(),
          },
        });
        emitReservationEvent(cancelledReservation);
      }
    }

    emitDepartureEvent(updatedDeparture);

    return {
      ...formatDepartureSummary(updatedDeparture as DepartureRecord),
      reservations: updatedDeparture.Reservations.map((reservation) =>
        formatReservationSummary(reservation as ReservationRecord)
      ),
    };
  });
}

export async function transitionP2PReservation(actor: BookingActor, reservationId: string, action: P2PReservationAction) {
  if (actor.role !== 'driver' && actor.role !== 'admin') {
    throw new BookingError('Only drivers and admins can update reservations.', 403, 'FORBIDDEN_ROLE');
  }

  const tenantId = requireActorTenantId(actor);
  const prisma = getPrisma();

  return prisma.$transaction(async (tx) => {
    const reservation = await findReservationOrThrow(tx, reservationId);
    assertTenantScope(reservation.tenantId, tenantId);

    const departure = await findDepartureOrThrow(tx, reservation.departureId);
    assertDriverCanOperateDeparture(actor, departure, tenantId);

    let nextData: Prisma.P2PReservationUpdateInput;

    switch (action) {
      case 'board':
        if (reservation.status !== 'confirmed') {
          throw new BookingError('Only confirmed reservations can be boarded.', 409, 'INVALID_RESERVATION_STATUS');
        }

        if (departure.status === 'scheduled') {
          await tx.p2PDeparture.update({
            where: { id: departure.id },
            data: {
              status: 'boarding',
              boardingStartedAt: departure.boardingStartedAt ?? new Date(),
            },
          });
        }

        nextData = {
          status: 'boarded',
          boardedAt: new Date(),
        };
        break;
      case 'complete':
        if (reservation.status !== 'boarded') {
          throw new BookingError('Only boarded reservations can be completed.', 409, 'INVALID_RESERVATION_STATUS');
        }
        nextData = {
          status: 'completed',
          completedAt: new Date(),
        };
        break;
      case 'no_show':
        if (reservation.status !== 'confirmed') {
          throw new BookingError('Only confirmed reservations can be marked no-show.', 409, 'INVALID_RESERVATION_STATUS');
        }
        nextData = {
          status: 'no_show',
        };
        break;
      default:
        throw new BookingError('Unsupported reservation action.', 400, 'INVALID_ACTION');
    }

    const updatedReservation = await tx.p2PReservation.update({
      where: { id: reservation.id },
      data: nextData,
      include: {
        Passenger: {
          select: {
            id: true,
            name: true,
            phone: true,
          },
        },
        Departure: {
          include: {
            Corridor: true,
            Driver: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
    });

    emitReservationEvent(updatedReservation);
    return formatReservationSummary(updatedReservation as ReservationRecord);
  });
}

export async function getAdminP2POverview(actor: BookingActor): Promise<AdminP2POverview> {
  assertRole(actor, 'admin');
  const tenantId = requireActorTenantId(actor);
  const prisma = getPrisma();
  const now = new Date();

  const [corridors, departures, activeReservations, drivers] = await Promise.all([
    prisma.p2PCorridor.findMany({
      where: { tenantId },
      orderBy: [{ isActive: 'desc' }, { name: 'asc' }],
    }),
    prisma.p2PDeparture.findMany({
      where: {
        tenantId,
        OR: [
          { departureTime: { gte: new Date(now.getTime() - 1000 * 60 * 60 * 12) } },
          { status: { in: ['scheduled', 'boarding', 'departed'] } },
        ],
      },
      include: {
        Corridor: true,
        Driver: {
          select: {
            id: true,
            name: true,
          },
        },
        Reservations: {
          include: {
            Passenger: {
              select: {
                id: true,
                name: true,
                phone: true,
              },
            },
            Departure: {
              include: {
                Corridor: true,
                Driver: {
                  select: {
                    id: true,
                    name: true,
                  },
                },
              },
            },
          },
          orderBy: [{ createdAt: 'asc' }],
        },
      },
      orderBy: [{ departureTime: 'asc' }],
      take: 24,
    }),
    prisma.p2PReservation.findMany({
      where: {
        tenantId,
        status: { in: ['confirmed', 'boarded'] },
      },
      include: {
        Passenger: {
          select: {
            id: true,
            name: true,
            phone: true,
          },
        },
        Departure: {
          include: {
            Corridor: true,
            Driver: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
      orderBy: [{ createdAt: 'desc' }],
      take: 24,
    }),
    prisma.user.findMany({
      where: {
        tenantId,
        role: 'driver',
      },
      select: {
        id: true,
        name: true,
        DriverProfile: {
          select: {
            TODATerminal: {
              select: {
                name: true,
              },
            },
          },
        },
      },
      orderBy: [{ name: 'asc' }],
    }),
  ]);

  const nextDepartureByCorridor = new Map<string, DepartureRecord>();
  departures.forEach((departure) => {
    if (!nextDepartureByCorridor.has(departure.corridorId)) {
      nextDepartureByCorridor.set(departure.corridorId, departure as DepartureRecord);
    }
  });

  return {
    corridors: corridors.map((corridor) =>
      formatCorridorSummary(corridor, nextDepartureByCorridor.get(corridor.id) ?? null)
    ),
    departures: departures.map((departure) => ({
      ...formatDepartureSummary(departure as DepartureRecord),
      reservations: departure.Reservations.map((reservation) =>
        formatReservationSummary(reservation as ReservationRecord)
      ),
    })),
    activeReservations: activeReservations.map((reservation) =>
      formatReservationSummary(reservation as ReservationRecord)
    ),
    drivers: drivers.map((driver) => ({
      id: driver.id,
      name: driver.name,
      todaName: driver.DriverProfile?.TODATerminal?.name ?? null,
    })),
  };
}
