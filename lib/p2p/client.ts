import type {
  AdminP2POverview,
  DriverP2PDashboard,
  P2PCorridorInput,
  P2PDepartureAction,
  P2PDepartureInput,
  P2PReservationAction,
  P2PReservationInput,
  PassengerP2PDashboard,
} from '@/lib/p2p/types';

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
    const detail = [errorPayload.code ? `code=${errorPayload.code}` : null, supportRequestId ? `requestId=${supportRequestId}` : null]
      .filter(Boolean)
      .join(', ');
    throw new Error(`${errorPayload.error ?? 'Request failed.'}${detail ? ` (${detail})` : ''}`);
  }

  if (payload && typeof payload === 'object' && 'data' in (payload as Record<string, unknown>)) {
    return (payload as { data: T }).data;
  }

  return payload as T;
}

export function getPassengerP2PDashboard() {
  return requestJson<PassengerP2PDashboard>('/api/bookings/p2p');
}

export function createP2PReservation(input: P2PReservationInput) {
  return requestJson<{ reservation: PassengerP2PDashboard['activeReservations'][number] }>('/api/bookings/p2p/reservations', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function cancelP2PReservation(reservationId: string) {
  return requestJson<{ reservation: PassengerP2PDashboard['activeReservations'][number] }>(
    `/api/bookings/p2p/reservations/${reservationId}/cancel`,
    {
      method: 'POST',
      body: JSON.stringify({}),
    }
  );
}

export function getDriverP2PDashboard() {
  return requestJson<DriverP2PDashboard>('/api/bookings/p2p/driver');
}

export function transitionP2PDeparture(departureId: string, action: P2PDepartureAction) {
  return requestJson<{ departure: DriverP2PDashboard['departures'][number] }>(
    `/api/bookings/p2p/departures/${departureId}/transition`,
    {
      method: 'POST',
      body: JSON.stringify({ action }),
    }
  );
}

export function transitionP2PReservation(reservationId: string, action: P2PReservationAction) {
  return requestJson<{ reservation: DriverP2PDashboard['departures'][number]['reservations'][number] }>(
    `/api/bookings/p2p/reservations/${reservationId}/transition`,
    {
      method: 'POST',
      body: JSON.stringify({ action }),
    }
  );
}

export function getAdminP2POverview() {
  return requestJson<AdminP2POverview>('/api/dashboard/admin/p2p');
}

export function createP2PCorridor(input: P2PCorridorInput) {
  return requestJson<{ corridor: AdminP2POverview['corridors'][number] }>('/api/dashboard/admin/p2p/corridors', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function createP2PDeparture(input: P2PDepartureInput) {
  return requestJson<{ departure: AdminP2POverview['departures'][number] }>('/api/dashboard/admin/p2p/departures', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}
