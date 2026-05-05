import type { Reservation, Ride, RideFeedback, TODATerminal } from '@prisma/client';
import type {
  OnDemandRouteAdjustments,
  QuoteInput,
  RideFeedbackInput,
  RideTransitionAction,
} from '@/lib/booking/types';

function createRequestId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  return `req-${Date.now().toString(36)}`;
}

async function requestJson<T>(input: string, init?: RequestInit): Promise<T> {
  const requestId = createRequestId();
  const response = await fetch(input, {
    cache: 'no-store',
    ...init,
    headers: {
      'content-type': 'application/json',
      'x-request-id': requestId,
      ...(init?.headers ?? {}),
    },
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const errorPayload = payload as {
      error?: string;
      code?: string;
      requestId?: string;
    };
    const responseRequestId = response.headers.get('x-request-id')?.trim();
    const supportRequestId = errorPayload.requestId ?? responseRequestId ?? requestId;

    const detailParts = [
      errorPayload.code ? `code=${errorPayload.code}` : null,
      supportRequestId ? `requestId=${supportRequestId}` : null,
    ].filter(Boolean);

    const detail = detailParts.length > 0 ? ` (${detailParts.join(', ')})` : '';
    throw new Error(`${errorPayload.error ?? 'Request failed.'}${detail}`);
  }

  if (payload && typeof payload === 'object' && 'data' in (payload as Record<string, unknown>)) {
    return (payload as { data: T }).data;
  }

  return payload as T;
}

export function quoteOnDemand(input: QuoteInput) {
  return requestJson<{
    fare: {
      totalFare: number;
      distanceKm: number;
      estimatedDurationMin: number;
      terminalAdjustment: number;
    };
    routeCoordinates: [number, number][];
    routeAdjustments?: OnDemandRouteAdjustments;
  }>(
    '/api/bookings/on-demand/quote',
    {
      method: 'POST',
      body: JSON.stringify(input),
    }
  );
}

export function createOnDemand(input: QuoteInput) {
  return requestJson<{ ride: Ride }>('/api/bookings/on-demand', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export type PassengerActiveRide = Ride & {
  driver: {
    id: string;
    name: string;
    rating: number | null;
  } | null;
};

export function getPassengerActiveRide() {
  return requestJson<{ ride: PassengerActiveRide | null }>('/api/bookings/on-demand/active');
}

export function cancelOnDemandRide(rideId: string) {
  return requestJson<{ ride: Ride }>(`/api/bookings/on-demand/${rideId}/cancel`, {
    method: 'POST',
    body: JSON.stringify({}),
  });
}

export function transitionRide(rideId: string, action: RideTransitionAction) {
  return requestJson<{ ride: Ride }>(`/api/bookings/rides/${rideId}/transition`, {
    method: 'POST',
    body: JSON.stringify({ action }),
  });
}

export function submitRideFeedback(rideId: string, input: RideFeedbackInput) {
  return requestJson<{ feedback: RideFeedback }>(`/api/bookings/rides/${rideId}/feedback`, {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export type DriverActiveRide = Ride & {
  passenger: {
    id: string;
    name: string;
  };
  terminal: {
    id: string;
    name: string;
    location: string;
  } | null;
};

export function getDriverActiveRide() {
  return requestJson<{ ride: DriverActiveRide | null }>('/api/bookings/driver/active-ride');
}

export function getDriverAssignedRides() {
  return requestJson<{ rides: Ride[] }>('/api/bookings/driver/assigned');
}

export interface DriverTodaTerminalContext {
  assignedTerminalId: string | null;
  visibilityScope: 'assigned_terminal_first' | 'tenant_wide';
}

export function getTodaTerminals(location?: { latitude: number; longitude: number }) {
  const query = location
    ? `?latitude=${encodeURIComponent(location.latitude)}&longitude=${encodeURIComponent(location.longitude)}`
    : '';

  return requestJson<{
    terminals: TODATerminal[];
    driverContext?: DriverTodaTerminalContext | null;
  }>(`/api/bookings/toda/terminals${query}`);
}

export type ReservationWithTerminal = Reservation & { TODATerminal: TODATerminal };
export type TerminalOnDemandRequest = Ride & {
  passenger: {
    id: string;
    name: string;
    phone: string;
  };
};

export function getMyTodaReservations() {
  return requestJson<{ reservations: ReservationWithTerminal[] }>('/api/bookings/toda/reservations/me');
}

export function createTodaReservation(terminalId: string, boardingTime?: string) {
  return requestJson<{ reservation: Reservation }>('/api/bookings/toda/reservations', {
    method: 'POST',
    body: JSON.stringify({
      terminalId,
      ...(boardingTime ? { boardingTime } : {}),
    }),
  });
}

export function cancelTodaReservation(reservationId: string) {
  return requestJson<{ reservation: Reservation }>(`/api/bookings/toda/reservations/${reservationId}/cancel`, {
    method: 'POST',
    body: JSON.stringify({}),
  });
}

export function getTodaTerminalRequests(terminalId: string) {
  return requestJson<{ rides: TerminalOnDemandRequest[] }>(
    `/api/bookings/toda/terminals/${terminalId}/requests`
  );
}

export function dispatchNextTodaRequest(terminalId: string) {
  return requestJson<{ ride: Ride | null }>(
    `/api/bookings/toda/terminals/${terminalId}/dispatch-next`,
    {
      method: 'POST',
      body: JSON.stringify({}),
    }
  );
}

