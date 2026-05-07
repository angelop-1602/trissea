import type {
  P2PDepartureStatus,
  P2PReservationStatus,
} from '@prisma/client';
import type { BookingActor } from '@/lib/booking/types';

export interface Coordinates {
  latitude: number;
  longitude: number;
}

export interface P2PCorridorInput {
  code: string;
  name: string;
  summary?: string;
  originLabel: string;
  origin: Coordinates;
  destinationLabel: string;
  destination: Coordinates;
  distanceKm: number;
  estimatedDuration: number;
  baseFare: number;
}

export interface P2PDepartureInput {
  corridorId: string;
  driverId?: string;
  vehicleLabel?: string;
  boardingBay: string;
  seatCapacity: number;
  departureTime: string;
}

export interface P2PReservationInput {
  departureId: string;
  seatCount: number;
}

export type P2PDepartureAction =
  | 'open_boarding'
  | 'depart'
  | 'complete'
  | 'cancel';

export type P2PReservationAction =
  | 'board'
  | 'complete'
  | 'no_show';

export interface P2PDepartureSummary {
  id: string;
  tenantId: string;
  corridorId: string;
  corridorCode: string;
  corridorName: string;
  corridorSummary: string | null;
  originLabel: string;
  destinationLabel: string;
  distanceKm: number;
  estimatedDuration: number;
  baseFare: number;
  departureTime: string;
  status: P2PDepartureStatus;
  boardingBay: string;
  seatCapacity: number;
  availableSeats: number;
  vehicleLabel: string | null;
  driver: {
    id: string;
    name: string;
  } | null;
}

export interface P2PReservationSummary {
  id: string;
  tenantId: string;
  departureId: string;
  bookingReference: string;
  seatCount: number;
  fareTotal: number;
  status: P2PReservationStatus;
  createdAt: string;
  boardedAt: string | null;
  completedAt: string | null;
  cancelledAt: string | null;
  passenger: {
    id: string;
    name: string;
    phone: string | null;
  } | null;
  departure: P2PDepartureSummary;
}

export interface P2PCorridorSummary {
  id: string;
  tenantId: string;
  code: string;
  name: string;
  summary: string | null;
  originLabel: string;
  destinationLabel: string;
  distanceKm: number;
  estimatedDuration: number;
  baseFare: number;
  isActive: boolean;
  nextDeparture: P2PDepartureSummary | null;
}

export interface PassengerP2PDashboard {
  corridors: P2PCorridorSummary[];
  upcomingDepartures: P2PDepartureSummary[];
  activeReservations: P2PReservationSummary[];
  recentReservations: P2PReservationSummary[];
}

export interface DriverP2PDashboard {
  departures: Array<
    P2PDepartureSummary & {
      reservations: P2PReservationSummary[];
    }
  >;
}

export interface AdminP2POverview {
  corridors: P2PCorridorSummary[];
  departures: Array<
    P2PDepartureSummary & {
      reservations: P2PReservationSummary[];
    }
  >;
  activeReservations: P2PReservationSummary[];
  drivers: Array<{
    id: string;
    name: string;
    todaName: string | null;
  }>;
}

export interface P2PTransitionActor extends BookingActor {}
