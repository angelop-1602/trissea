'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  ArrowRight,
  BusFront,
  CalendarClock,
  Clock3,
  MapPinned,
  RefreshCw,
  Route,
  Ticket,
  XCircle,
} from 'lucide-react';
import { PassengerAppShell } from '@/components/passenger/passenger-app-shell';
import { InlineErrorState, PageLoadingState } from '@/components/page-state';
import { PassengerMetricPill } from '@/components/passenger/passenger-surfaces';
import { Button } from '@/components/ui/button';
import { useBookingRealtime } from '@/hooks/use-booking-realtime';
import { cancelP2PReservation, createP2PReservation, getPassengerP2PDashboard } from '@/lib/p2p/client';
import type { P2PCorridorSummary, P2PDepartureSummary, P2PReservationSummary, PassengerP2PDashboard } from '@/lib/p2p/types';
import { useStore } from '@/lib/store-context';
import { cn } from '@/lib/utils';

function formatCurrency(value: number) {
  return new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: 'PHP',
    maximumFractionDigits: 0,
  }).format(value);
}

function formatDepartureTime(value: string) {
  return new Intl.DateTimeFormat('en-PH', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(value));
}

function getDepartureTone(status: P2PDepartureSummary['status']) {
  switch (status) {
    case 'boarding':
      return 'border-primary/25 bg-primary/10 text-primary';
    case 'departed':
      return 'border-secondary/30 bg-secondary/10 text-secondary';
    case 'completed':
      return 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700';
    case 'cancelled':
      return 'border-destructive/30 bg-destructive/10 text-destructive';
    default:
      return 'border-border/60 bg-background/70 text-muted-foreground';
  }
}

function getReservationTone(status: P2PReservationSummary['status']) {
  switch (status) {
    case 'boarded':
      return 'border-primary/25 bg-primary/10 text-primary';
    case 'completed':
      return 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700';
    case 'cancelled':
    case 'no_show':
      return 'border-destructive/30 bg-destructive/10 text-destructive';
    default:
      return 'border-border/60 bg-background/70 text-muted-foreground';
  }
}

function CorridorCard({
  corridor,
  isBusy,
  onReserve,
}: {
  corridor: P2PCorridorSummary;
  isBusy: boolean;
  onReserve: (departureId: string) => void;
}) {
  const nextDeparture = corridor.nextDeparture;

  return (
    <div className="space-y-4 rounded-[1.9rem] border border-border/60 bg-background/58 px-4 py-4">
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/15 bg-primary/8 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-primary">
            <Route className="h-3.5 w-3.5" />
            {corridor.code}
          </div>
          <h2 className="text-lg font-semibold tracking-tight text-foreground">{corridor.name}</h2>
          <p className="text-sm text-muted-foreground">
            {corridor.originLabel} to {corridor.destinationLabel}
          </p>
          {corridor.summary ? <p className="text-sm text-muted-foreground">{corridor.summary}</p> : null}
        </div>
        <div className="rounded-[1.1rem] border border-border/45 bg-card px-3 py-2 text-right">
          <p className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">Flat fare</p>
          <p className="mt-1 text-sm font-semibold text-foreground">{formatCurrency(corridor.baseFare)}</p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 text-xs">
        <PassengerMetricPill label="Distance" value={`${corridor.distanceKm} km`} />
        <PassengerMetricPill label="Travel" value={`${corridor.estimatedDuration} min`} />
        <PassengerMetricPill label="Seats" value={nextDeparture ? `${nextDeparture.availableSeats} open` : 'Check admin'} />
      </div>

      {nextDeparture ? (
        <div className="rounded-[1.35rem] border border-primary/15 bg-primary/[0.05] px-3.5 py-3">
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-1">
              <p className="text-[11px] uppercase tracking-[0.15em] text-muted-foreground">Next departure</p>
              <p className="text-base font-semibold text-foreground">{formatDepartureTime(nextDeparture.departureTime)}</p>
              <p className="text-sm text-muted-foreground">
                Bay {nextDeparture.boardingBay}
                {nextDeparture.vehicleLabel ? ` • ${nextDeparture.vehicleLabel}` : ''}
                {nextDeparture.driver ? ` • ${nextDeparture.driver.name}` : ''}
              </p>
            </div>
            <span className={cn('inline-flex rounded-full border px-3 py-1 text-[11px] font-medium', getDepartureTone(nextDeparture.status))}>
              {nextDeparture.status}
            </span>
          </div>
          <Button
            className="mt-3 h-11 w-full rounded-full"
            disabled={isBusy || nextDeparture.availableSeats <= 0 || nextDeparture.status === 'cancelled'}
            onClick={() => onReserve(nextDeparture.id)}
          >
            {isBusy ? 'Saving reservation...' : nextDeparture.availableSeats <= 0 ? 'Sold out' : 'Reserve 1 seat'}
          </Button>
        </div>
      ) : (
        <div className="rounded-[1.3rem] border border-dashed border-border/70 bg-card/50 px-4 py-4 text-sm text-muted-foreground">
          No upcoming departure is published for this corridor yet.
        </div>
      )}
    </div>
  );
}

function ReservationCard({
  reservation,
  isBusy,
  onCancel,
}: {
  reservation: P2PReservationSummary;
  isBusy: boolean;
  onCancel: (reservationId: string) => void;
}) {
  return (
    <div className="space-y-3 rounded-[1.7rem] border border-border/60 bg-background/58 px-4 py-4">
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <p className="text-sm font-semibold text-foreground">{reservation.departure.corridorName}</p>
          <p className="text-sm text-muted-foreground">
            {reservation.departure.originLabel} to {reservation.departure.destinationLabel}
          </p>
          <p className="text-xs text-muted-foreground">
            {formatDepartureTime(reservation.departure.departureTime)} • Bay {reservation.departure.boardingBay}
          </p>
        </div>
        <span className={cn('inline-flex rounded-full border px-3 py-1 text-[11px] font-medium', getReservationTone(reservation.status))}>
          {reservation.status}
        </span>
      </div>

      <div className="grid grid-cols-3 gap-2 text-xs">
        <PassengerMetricPill label="Reference" value={reservation.bookingReference} />
        <PassengerMetricPill label="Seats" value={`${reservation.seatCount}`} />
        <PassengerMetricPill label="Fare" value={formatCurrency(reservation.fareTotal)} />
      </div>

      <div className="flex flex-wrap gap-2">
        {reservation.status === 'confirmed' ? (
          <Button
            variant="outline"
            className="h-10 rounded-full"
            disabled={isBusy}
            onClick={() => onCancel(reservation.id)}
          >
            <XCircle className="mr-2 h-4 w-4" />
            {isBusy ? 'Cancelling...' : 'Cancel seat'}
          </Button>
        ) : null}
        <Link href="/passenger/activity" className="flex-1 min-w-[10rem]">
          <Button variant="ghost" className="h-10 w-full rounded-full">
            Open Activity
          </Button>
        </Link>
      </div>
    </div>
  );
}

export default function PassengerP2PPage() {
  const { currentUser, currentTenant } = useStore();
  const [data, setData] = useState<PassengerP2PDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [savingDepartureId, setSavingDepartureId] = useState<string | null>(null);
  const [cancellingReservationId, setCancellingReservationId] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const canLoad = currentUser?.role === 'passenger';

  const loadDashboard = useCallback(async (reason: 'initial' | 'manual' | 'realtime' = 'manual') => {
    if (!canLoad) return;
    if (reason !== 'initial') {
      setIsRefreshing(true);
    }
    try {
      const next = await getPassengerP2PDashboard();
      setData(next);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load P2P departures.');
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }, [canLoad]);

  useEffect(() => {
    void loadDashboard('initial');
  }, [loadDashboard]);

  useBookingRealtime({
    enabled: Boolean(canLoad),
    onUpdate: (payload) => {
      if (
        payload.type === 'p2p.departure.updated' ||
        payload.type === 'p2p.reservation.updated' ||
        payload.type === 'p2p.corridor.updated'
      ) {
        void loadDashboard('realtime');
      }
    },
  });

  const handleReserve = useCallback(async (departureId: string) => {
    setSavingDepartureId(departureId);
    try {
      await createP2PReservation({ departureId, seatCount: 1 });
      await loadDashboard('manual');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reserve the departure.');
    } finally {
      setSavingDepartureId(null);
    }
  }, [loadDashboard]);

  const handleCancel = useCallback(async (reservationId: string) => {
    setCancellingReservationId(reservationId);
    try {
      await cancelP2PReservation(reservationId);
      await loadDashboard('manual');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to cancel reservation.');
    } finally {
      setCancellingReservationId(null);
    }
  }, [loadDashboard]);

  const heroDeparture = useMemo(() => data?.upcomingDepartures[0] ?? null, [data]);

  if (!currentUser || currentUser.role !== 'passenger' || loading) {
    return (
      <PageLoadingState
        label="Loading P2P workspace..."
        className="theme-passenger min-h-screen bg-background text-foreground"
      />
    );
  }

  return (
    <PassengerAppShell
      title="P2P"
      subtitle="Reserve direct point-to-point departures."
      backHref="/passenger/modules"
      topContext="P2P"
      headerVariant="compact"
      headerSurface="minimal"
    >
      <section className="space-y-4 rounded-[2rem] border border-primary/15 bg-primary/[0.07] px-4 py-5">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">P2P shuttle</p>
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">
              {currentTenant?.name ?? 'Tenant'} direct departures
            </h1>
            <p className="text-sm text-muted-foreground">
              Book fixed-route seats, arrive at the right bay on time, and track one clean boarding flow from reservation to departure.
            </p>
          </div>
          <Button variant="outline" className="h-10 rounded-full" onClick={() => void loadDashboard('manual')} disabled={isRefreshing}>
            <RefreshCw className={cn('mr-2 h-4 w-4', isRefreshing && 'animate-spin')} />
            Refresh
          </Button>
        </div>

        <div className="grid grid-cols-3 gap-2 text-xs">
          <PassengerMetricPill label="Corridors" value={`${data?.corridors.length ?? 0}`} />
          <PassengerMetricPill label="Upcoming" value={`${data?.upcomingDepartures.length ?? 0}`} />
          <PassengerMetricPill label="Active seats" value={`${data?.activeReservations.length ?? 0}`} />
        </div>

        {heroDeparture ? (
          <div className="rounded-[1.55rem] border border-primary/15 bg-card/80 px-4 py-4">
            <div className="flex items-start gap-3">
              <div className="rounded-full border border-primary/20 bg-primary/10 p-2 text-primary">
                <BusFront className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1 space-y-1">
                <p className="text-sm font-semibold text-foreground">{heroDeparture.corridorName}</p>
                <p className="text-sm text-muted-foreground">
                  {heroDeparture.originLabel} to {heroDeparture.destinationLabel}
                </p>
                <p className="text-xs text-muted-foreground">
                  {formatDepartureTime(heroDeparture.departureTime)} • Bay {heroDeparture.boardingBay} • {heroDeparture.availableSeats} seats open
                </p>
              </div>
              <Link href="/passenger/tricycle">
                <Button size="icon" variant="ghost" className="rounded-full">
                  <MapPinned className="h-4 w-4" />
                </Button>
              </Link>
            </div>
          </div>
        ) : null}
      </section>

      {error ? <InlineErrorState message={error} onRetry={() => void loadDashboard('manual')} /> : null}

      <section className="space-y-3">
        <div className="px-1">
          <h2 className="text-sm font-semibold tracking-tight text-foreground">Your active reservations</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Keep these handy when you need your boarding bay, seat count, and booking reference.
          </p>
        </div>
        {data?.activeReservations.length ? (
          <div className="space-y-3">
            {data.activeReservations.map((reservation) => (
              <ReservationCard
                key={reservation.id}
                reservation={reservation}
                isBusy={cancellingReservationId === reservation.id}
                onCancel={handleCancel}
              />
            ))}
          </div>
        ) : (
          <div className="rounded-[1.85rem] border border-border/60 bg-background/58 px-4 py-8 text-center">
            <Ticket className="mx-auto h-8 w-8 text-primary" />
            <p className="mt-3 text-sm font-semibold text-foreground">No active P2P seats yet</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Pick one of the published corridors below to reserve your next direct trip.
            </p>
          </div>
        )}
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between gap-3 px-1">
          <div>
            <h2 className="text-sm font-semibold tracking-tight text-foreground">Available corridors</h2>
            <p className="mt-1 text-sm text-muted-foreground">Each corridor keeps one direct origin and destination pairing.</p>
          </div>
          <span className="text-xs text-muted-foreground">{data?.corridors.length ?? 0} routes</span>
        </div>
        {data?.corridors.length ? (
          <div className="space-y-3">
            {data.corridors.map((corridor) => (
              <CorridorCard
                key={corridor.id}
                corridor={corridor}
                isBusy={savingDepartureId === corridor.nextDeparture?.id}
                onReserve={handleReserve}
              />
            ))}
          </div>
        ) : (
          <div className="rounded-[1.85rem] border border-dashed border-border/70 bg-background/60 px-4 py-8 text-center text-sm text-muted-foreground">
            P2P corridors will appear here once tenant operations publishes direct routes.
          </div>
        )}
      </section>

      <section className="rounded-[1.7rem] border border-border/60 bg-background/60 px-4 py-4">
        <div className="flex items-start gap-3">
          <div className="rounded-full border border-primary/20 bg-primary/10 p-2 text-primary">
            <CalendarClock className="h-4 w-4" />
          </div>
          <div className="space-y-1">
            <p className="text-sm font-medium text-foreground">Passenger flow</p>
            <p className="text-sm text-muted-foreground">
              Reserve first, arrive early, and board from the assigned bay. This module is optimized for predictable direct trips instead of open street hails.
            </p>
          </div>
        </div>
      </section>

      <div className="flex flex-wrap gap-2">
        <Link href="/passenger/modules" className="flex-1 min-w-[10rem]">
          <Button variant="outline" className="h-11 w-full rounded-full">
            Back to Modules
          </Button>
        </Link>
        <Link href="/passenger/tricycle" className="flex-1 min-w-[10rem]">
          <Button className="h-11 w-full rounded-full">
            Open Tricycle
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </Link>
      </div>
    </PassengerAppShell>
  );
}
