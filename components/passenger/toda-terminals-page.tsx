'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Building2, Clock3, MapPin, Navigation, Users } from 'lucide-react';
import type { Reservation, TODATerminal } from '@prisma/client';
import { useStore } from '@/lib/store-context';
import { PassengerAppShell } from '@/components/passenger/passenger-app-shell';
import { PageLoadingState, InlineErrorState } from '@/components/page-state';
import { StatusBadge } from '@/components/status-badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PassengerMetricPill } from '@/components/passenger/passenger-surfaces';
import {
  cancelTodaReservation,
  createTodaReservation,
  getMyTodaReservations,
  getTodaTerminals,
  type ReservationWithTerminal,
} from '@/lib/booking/client';
import { useBookingRealtime } from '@/hooks/use-booking-realtime';
import { useUserLocation } from '@/hooks/use-user-location';

function haversineKm(
  from: { latitude: number; longitude: number },
  to: { latitude: number; longitude: number }
) {
  const earthRadiusKm = 6371;
  const dLat = ((to.latitude - from.latitude) * Math.PI) / 180;
  const dLon = ((to.longitude - from.longitude) * Math.PI) / 180;
  const lat1 = (from.latitude * Math.PI) / 180;
  const lat2 = (to.latitude * Math.PI) / 180;

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.sin(dLon / 2) * Math.sin(dLon / 2) * Math.cos(lat1) * Math.cos(lat2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return earthRadiusKm * c;
}

function formatDistance(distanceKm: number | null) {
  if (distanceKm === null) {
    return 'Distance unavailable';
  }

  if (distanceKm < 1) {
    return `${Math.round(distanceKm * 1000)} m away`;
  }

  return `${distanceKm.toFixed(2)} km away`;
}

function formatBoardingTime(value: string | Date | null | undefined) {
  if (!value) {
    return 'Join queue now';
  }

  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return 'Join queue now';
  }

  return new Intl.DateTimeFormat('en-PH', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
}

function toDateTimeLocalValue(date: Date) {
  const pad = (value: number) => value.toString().padStart(2, '0');
  return [
    date.getFullYear(),
    '-',
    pad(date.getMonth() + 1),
    '-',
    pad(date.getDate()),
    'T',
    pad(date.getHours()),
    ':',
    pad(date.getMinutes()),
  ].join('');
}

function isReservationActive(reservation: Reservation) {
  return reservation.status === 'confirmed' || reservation.status === 'arrived';
}

function TodaSectionTitle({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="space-y-2 px-1">
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <h2 className="text-sm font-semibold tracking-tight text-foreground">{title}</h2>
          {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
        </div>
        {action}
      </div>
    </div>
  );
}

function TerminalListRow({
  terminal,
  distanceKm,
  selected,
  reserved,
  onClick,
}: {
  terminal: TODATerminal;
  distanceKm: number | null;
  selected: boolean;
  reserved: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        'w-full px-4 py-4 text-left transition',
        selected ? 'bg-primary/8' : 'bg-transparent hover:bg-muted/12',
      ].join(' ')}
    >
      <div className="flex items-start gap-3">
        <div
          className={[
            'mt-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl',
            selected ? 'bg-primary/12 text-primary' : 'bg-muted/20 text-muted-foreground',
          ].join(' ')}
        >
          <Building2 className="h-4 w-4" />
        </div>

        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 space-y-1">
              <p className="text-sm font-medium">{terminal.name}</p>
              <p className="text-xs text-muted-foreground">{terminal.location}</p>
            </div>
            {reserved ? (
              <span className="inline-flex rounded-full border border-primary/25 bg-primary/10 px-2 py-1 text-[11px] font-medium text-primary">
                Reserved
              </span>
            ) : null}
          </div>

          <div className="flex flex-wrap gap-2 text-[11px] text-muted-foreground">
            <span className="inline-flex items-center gap-1 rounded-full bg-muted/20 px-2.5 py-1">
              <Navigation className="h-3 w-3 text-primary" />
              {formatDistance(distanceKm)}
            </span>
            <span className="inline-flex items-center gap-1 rounded-full bg-muted/20 px-2.5 py-1">
              <Users className="h-3 w-3 text-primary" />
              Queue {terminal.currentQueued}/{terminal.capacity}
            </span>
            {selected ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-1 text-primary">
                Selected
              </span>
            ) : null}
          </div>
        </div>
      </div>
    </button>
  );
}

export function PassengerTodaTerminalsPage() {
  const { currentUser } = useStore();
  const [terminals, setTerminals] = useState<TODATerminal[]>([]);
  const [reservations, setReservations] = useState<ReservationWithTerminal[]>([]);
  const [selectedTerminalId, setSelectedTerminalId] = useState<string | null>(null);
  const [boardingTime, setBoardingTime] = useState(() => toDateTimeLocalValue(new Date()));
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reservationError, setReservationError] = useState<string | null>(null);
  const [reservationNotice, setReservationNotice] = useState<string | null>(null);
  const [isCreatingReservation, setIsCreatingReservation] = useState(false);
  const [reservationCancelId, setReservationCancelId] = useState<string | null>(null);
  const isLoadingDataRef = useRef(false);
  const userLocation = useUserLocation();

  const canLoad = currentUser?.role === 'passenger';

  const loadData = useCallback(async () => {
    if (!canLoad || isLoadingDataRef.current) return;

    isLoadingDataRef.current = true;
    try {
      const [terminalsResponse, reservationsResponse] = await Promise.all([
        getTodaTerminals(
          userLocation
            ? {
                latitude: userLocation.latitude,
                longitude: userLocation.longitude,
              }
            : undefined
        ),
        getMyTodaReservations(),
      ]);

      setTerminals(terminalsResponse.terminals);
      setReservations(reservationsResponse.reservations);
      setSelectedTerminalId((current) =>
        current && terminalsResponse.terminals.some((terminal) => terminal.id === current)
          ? current
          : terminalsResponse.terminals[0]?.id ?? null
      );
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load TODA terminals.');
    } finally {
      isLoadingDataRef.current = false;
      setLoading(false);
    }
  }, [canLoad, userLocation]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  useBookingRealtime({
    enabled: Boolean(canLoad),
    onUpdate: (payload) => {
      if (payload.type === 'terminal.updated' || payload.type === 'reservation.updated') {
        void loadData();
      }
    },
  });

  const terminalsWithDistance = useMemo(() => {
    const withDistance = terminals.map((terminal) => ({
      terminal,
      distanceKm: userLocation
        ? haversineKm(userLocation, {
            latitude: terminal.latitude,
            longitude: terminal.longitude,
          })
        : null,
    }));

    return withDistance.sort(
      (a, b) => (a.distanceKm ?? Number.MAX_SAFE_INTEGER) - (b.distanceKm ?? Number.MAX_SAFE_INTEGER)
    );
  }, [terminals, userLocation]);

  const activeReservations = useMemo(
    () => reservations.filter((reservation) => isReservationActive(reservation)),
    [reservations]
  );

  const nearestTerminal = terminalsWithDistance[0] ?? null;
  const selectedTerminalEntry =
    terminalsWithDistance.find((entry) => entry.terminal.id === selectedTerminalId) ?? nearestTerminal;
  const selectedTerminal = selectedTerminalEntry?.terminal ?? null;
  const selectedTerminalDistance = selectedTerminalEntry?.distanceKm ?? null;
  const selectedTerminalReservation =
    activeReservations.find((reservation) => reservation.terminalId === selectedTerminal?.id) ?? null;

  const handleCreateReservation = async () => {
    if (!selectedTerminal) return;

    setReservationError(null);
    setReservationNotice(null);
    setIsCreatingReservation(true);

    try {
      const result = await createTodaReservation(
        selectedTerminal.id,
        boardingTime ? new Date(boardingTime).toISOString() : undefined
      );

      const existingReservation = activeReservations.some(
        (reservation) => reservation.id === result.reservation.id
      );

      setReservationNotice(
        existingReservation
          ? 'Your current reservation at this terminal is still active.'
          : 'Reservation confirmed. Your queue position has been saved.'
      );
      await loadData();
    } catch (err) {
      setReservationError(err instanceof Error ? err.message : 'Failed to create reservation.');
    } finally {
      setIsCreatingReservation(false);
    }
  };

  const handleCancelReservation = async (reservationId: string) => {
    setReservationError(null);
    setReservationNotice(null);
    setReservationCancelId(reservationId);

    try {
      await cancelTodaReservation(reservationId);
      setReservationNotice('Reservation cancelled. Queue positions will update automatically.');
      await loadData();
    } catch (err) {
      setReservationError(err instanceof Error ? err.message : 'Failed to cancel reservation.');
    } finally {
      setReservationCancelId(null);
    }
  };

  if (!currentUser || currentUser.role !== 'passenger' || loading) {
    return (
      <PageLoadingState
        label="Loading TODA terminals..."
        tone="passenger"
      />
    );
  }

  return (
    <PassengerAppShell
      title="TODA"
      subtitle="Nearest queue, terminal list, and reservations."
      topContext="TODA"
      headerVariant="compact"
      headerSurface="minimal"
    >
      {activeReservations.length > 0 ? (
        <section className="space-y-3">
          <TodaSectionTitle
            title="Active reservations"
            description="Your queue position and terminal status stay separate from on-demand rides."
            action={
              <Link href="/passenger/activity">
                <Button variant="ghost" className="rounded-full px-3 text-sm">
                  View Activity
                </Button>
              </Link>
            }
          />

          <div className="overflow-hidden rounded-[1.9rem] border border-border/60 bg-background/58">
            {activeReservations.map((reservation) => {
              const canCancel = reservation.status === 'confirmed';

              return (
                <div key={reservation.id} className="space-y-4 border-b border-border/55 px-4 py-4 last:border-b-0">
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1">
                      <p className="text-sm font-medium">{reservation.TODATerminal.name}</p>
                      <p className="text-xs text-muted-foreground">{reservation.TODATerminal.location}</p>
                    </div>
                    <StatusBadge status={reservation.status} />
                  </div>

                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <PassengerMetricPill label="Queue" value={`#${reservation.queuePosition}`} />
                    <PassengerMetricPill label="Boarding" value={formatBoardingTime(reservation.boardingTime)} />
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant={canCancel ? 'outline' : 'secondary'}
                      className="rounded-full"
                      disabled={!canCancel || reservationCancelId === reservation.id}
                      onClick={() => void handleCancelReservation(reservation.id)}
                    >
                      {reservationCancelId === reservation.id
                        ? 'Cancelling...'
                        : canCancel
                          ? 'Cancel Reservation'
                          : 'Cancellation Unavailable'}
                    </Button>
                    <Button
                      variant="ghost"
                      className="rounded-full"
                      onClick={() => setSelectedTerminalId(reservation.terminalId)}
                    >
                      View Terminal
                    </Button>
                  </div>

                  {!canCancel ? (
                    <p className="text-xs text-muted-foreground">
                      Cancellation is only available while the reservation is still confirmed.
                    </p>
                  ) : null}
                </div>
              );
            })}
          </div>
        </section>
      ) : null}

      <section className="space-y-4 rounded-[2rem] border border-primary/15 bg-primary/6 px-4 py-5">
        <div className="space-y-1">
          <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Nearest TODA</p>
          <h2 className="text-lg font-semibold tracking-tight">
            {nearestTerminal?.terminal.name ?? 'No terminal available'}
          </h2>
          <p className="text-sm text-muted-foreground">
            {nearestTerminal
              ? `${nearestTerminal.terminal.location} | ${formatDistance(nearestTerminal.distanceKm)}`
              : 'Check back when a TODA terminal is available in your area.'}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Link href="/passenger/on-demand" className="flex-1 min-w-[10rem]">
            <Button className="h-11 w-full rounded-full">Book Ride</Button>
          </Link>
          {nearestTerminal ? (
            <Button
              variant="outline"
              className="h-11 flex-1 min-w-[10rem] rounded-full"
              onClick={() => setSelectedTerminalId(nearestTerminal.terminal.id)}
            >
              Open nearest TODA
            </Button>
          ) : null}
        </div>
      </section>

      {error ? <InlineErrorState message={error} onRetry={() => void loadData()} /> : null}
      {reservationError ? <InlineErrorState message={reservationError} /> : null}

      {reservationNotice ? (
        <div className="rounded-[1.4rem] border border-primary/20 bg-primary/5 px-4 py-3 text-sm text-foreground">
          {reservationNotice}
        </div>
      ) : null}

      {terminalsWithDistance.length === 0 ? (
        <div className="rounded-[1.85rem] border border-border/60 bg-background/58 py-10 text-center">
          <Building2 className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">No TODA terminals are available yet.</p>
        </div>
      ) : (
        <>
          <section className="space-y-3">
            <TodaSectionTitle
              title="Nearby terminals"
              description="Terminals stay separate from on-demand booking and let you join a real queue."
            />

            <div className="divide-y divide-border/55 overflow-hidden rounded-[1.9rem] border border-border/60 bg-background/58">
              {terminalsWithDistance.map(({ terminal, distanceKm }) => {
                const hasActiveReservation = activeReservations.some(
                  (reservation) => reservation.terminalId === terminal.id
                );
                const isSelected = terminal.id === selectedTerminal?.id;

                return (
                  <TerminalListRow
                    key={terminal.id}
                    terminal={terminal}
                    distanceKm={distanceKm}
                    selected={isSelected}
                    reserved={hasActiveReservation}
                    onClick={() => setSelectedTerminalId(terminal.id)}
                  />
                );
              })}
            </div>
          </section>

          {selectedTerminal ? (
            <section className="space-y-4 rounded-[1.9rem] border border-border/60 bg-background/58 px-4 py-4">
              <div className="space-y-1">
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1">
                    <h3 className="text-base font-semibold">{selectedTerminal.name}</h3>
                    <p className="text-sm text-muted-foreground">{selectedTerminal.location}</p>
                  </div>
                  {selectedTerminalReservation ? <StatusBadge status={selectedTerminalReservation.status} /> : null}
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <PassengerMetricPill
                  label="Distance"
                  value={
                    <span className="inline-flex items-center gap-1">
                      <Navigation className="h-3.5 w-3.5 text-primary" />
                      {formatDistance(selectedTerminalDistance)}
                    </span>
                  }
                />
                <PassengerMetricPill
                  label="Queue"
                  value={
                    <span className="inline-flex items-center gap-1">
                      <Users className="h-3.5 w-3.5 text-primary" />
                      {selectedTerminal.currentQueued} / {selectedTerminal.capacity}
                    </span>
                  }
                />
              </div>

              <div className="space-y-4 rounded-[1.6rem] border border-border/55 bg-background/45 px-4 py-4">
                <div className="flex items-start gap-3">
                  <Clock3 className="mt-0.5 h-4 w-4 text-primary" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium">Reserve your queue slot</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Optional boarding time is supported. Leave it as-is if you want to join the queue now.
                    </p>
                  </div>
                </div>

                <label className="block space-y-2">
                  <span className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
                    Boarding time
                  </span>
                  <Input
                    type="datetime-local"
                    value={boardingTime}
                    onChange={(event) => setBoardingTime(event.target.value)}
                    className="rounded-2xl"
                  />
                </label>

                {selectedTerminalReservation ? (
                  <div className="rounded-[1.35rem] border border-primary/20 bg-primary/5 p-3 text-sm">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium">You already have an active reservation here</span>
                    </div>
                    <p className="mt-2 text-muted-foreground">
                      Queue position #{selectedTerminalReservation.queuePosition} |{' '}
                      {formatBoardingTime(selectedTerminalReservation.boardingTime)}
                    </p>
                  </div>
                ) : null}

                <div className="flex flex-wrap gap-2">
                  <Button
                    className="h-11 flex-1 rounded-full"
                    onClick={() => void handleCreateReservation()}
                    disabled={isCreatingReservation}
                  >
                    {isCreatingReservation ? 'Saving reservation...' : 'Reserve at this TODA'}
                  </Button>
                  <Link href="/passenger/on-demand" className="flex-1 min-w-[10rem]">
                    <Button variant="outline" className="h-11 w-full rounded-full">
                      Book Ride Instead
                    </Button>
                  </Link>
                </div>
              </div>

              <div className="rounded-[1.5rem] bg-muted/15 px-4 py-4 text-sm text-muted-foreground">
                <div className="flex items-start gap-2">
                  <MapPin className="mt-0.5 h-4 w-4 text-primary" />
                  <p>
                    Your reservation is tied to this terminal. Queue positions move automatically as confirmed
                    reservations are cancelled or completed.
                  </p>
                </div>
              </div>
            </section>
          ) : null}
        </>
      )}
    </PassengerAppShell>
  );
}
