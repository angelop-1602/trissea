'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowRightLeft, BusFront, CalendarClock, CheckCircle2, Clock3, RefreshCw, Route, UserRoundX, Users } from 'lucide-react';
import { DriverAppShell } from '@/components/driver/driver-app-shell';
import { InlineErrorState, PageLoadingState } from '@/components/page-state';
import { PassengerMetricPill } from '@/components/passenger/passenger-surfaces';
import { Button } from '@/components/ui/button';
import { useBookingRealtime } from '@/hooks/use-booking-realtime';
import { getDriverP2PDashboard, transitionP2PDeparture, transitionP2PReservation } from '@/lib/p2p/client';
import type { DriverP2PDashboard } from '@/lib/p2p/types';
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

function getDepartureAction(status: DriverP2PDashboard['departures'][number]['status']) {
  switch (status) {
    case 'scheduled':
      return { action: 'open_boarding' as const, label: 'Open boarding' };
    case 'boarding':
      return { action: 'depart' as const, label: 'Depart trip' };
    case 'departed':
      return { action: 'complete' as const, label: 'Complete trip' };
    default:
      return null;
  }
}

function getDepartureTone(status: DriverP2PDashboard['departures'][number]['status']) {
  switch (status) {
    case 'boarding':
      return 'border-primary/25 bg-primary/10 text-primary';
    case 'departed':
      return 'border-secondary/25 bg-secondary/10 text-secondary';
    case 'completed':
      return 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700';
    case 'cancelled':
      return 'border-destructive/30 bg-destructive/10 text-destructive';
    default:
      return 'border-border/60 bg-background/70 text-muted-foreground';
  }
}

export default function DriverP2PPage() {
  const { currentUser } = useStore();
  const [data, setData] = useState<DriverP2PDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [departureActionId, setDepartureActionId] = useState<string | null>(null);
  const [reservationActionId, setReservationActionId] = useState<string | null>(null);

  const canLoad = currentUser?.role === 'driver';

  const loadDashboard = useCallback(async (reason: 'initial' | 'manual' | 'realtime' = 'manual') => {
    if (!canLoad) return;
    if (reason !== 'initial') setIsRefreshing(true);
    try {
      const next = await getDriverP2PDashboard();
      setData(next);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load driver departures.');
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
      if (payload.type === 'p2p.departure.updated' || payload.type === 'p2p.reservation.updated') {
        void loadDashboard('realtime');
      }
    },
  });

  const handleDepartureAction = useCallback(async (departureId: string, action: 'open_boarding' | 'depart' | 'complete' | 'cancel') => {
    setDepartureActionId(`${departureId}:${action}`);
    try {
      await transitionP2PDeparture(departureId, action);
      await loadDashboard('manual');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update departure.');
    } finally {
      setDepartureActionId(null);
    }
  }, [loadDashboard]);

  const handleReservationAction = useCallback(async (reservationId: string, action: 'board' | 'complete' | 'no_show') => {
    setReservationActionId(`${reservationId}:${action}`);
    try {
      await transitionP2PReservation(reservationId, action);
      await loadDashboard('manual');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update passenger status.');
    } finally {
      setReservationActionId(null);
    }
  }, [loadDashboard]);

  const activeDeparture = useMemo(() => data?.departures[0] ?? null, [data]);

  if (!currentUser || currentUser.role !== 'driver' || loading) {
    return (
      <PageLoadingState
        label="Loading driver P2P workspace..."
        className="theme-driver min-h-screen bg-background text-foreground"
      />
    );
  }

  return (
    <DriverAppShell
      title="P2P"
      subtitle="Operate assigned departures and manifests."
      backHref="/driver/modules"
      topContext="P2P"
      headerVariant="compact"
      headerSurface="minimal"
    >
      <section className="space-y-4 rounded-[2rem] border border-primary/15 bg-primary/[0.07] px-4 py-5">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">P2P operations</p>
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">Departure board and manifest</h1>
            <p className="text-sm text-muted-foreground">
              Work through one scheduled departure at a time: open boarding, check riders in, depart, and close the trip cleanly.
            </p>
          </div>
          <Button variant="outline" className="h-10 rounded-full" onClick={() => void loadDashboard('manual')} disabled={isRefreshing}>
            <RefreshCw className={cn('mr-2 h-4 w-4', isRefreshing && 'animate-spin')} />
            Refresh
          </Button>
        </div>

        <div className="grid grid-cols-3 gap-2 text-xs">
          <PassengerMetricPill label="Assigned" value={`${data?.departures.length ?? 0}`} />
          <PassengerMetricPill label="Seats boarded" value={`${data?.departures.reduce((sum, departure) => sum + departure.reservations.filter((item) => item.status === 'boarded').length, 0) ?? 0}`} />
          <PassengerMetricPill label="Live trip" value={activeDeparture ? activeDeparture.status : 'idle'} />
        </div>
      </section>

      {error ? <InlineErrorState message={error} onRetry={() => void loadDashboard('manual')} /> : null}

      {data?.departures.length ? (
        <div className="space-y-4">
          {data.departures.map((departure, index) => {
            const primaryAction = getDepartureAction(departure.status);
            return (
              <section key={departure.id} className="space-y-4 rounded-[1.95rem] border border-border/60 bg-background/58 px-4 py-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1">
                    <div className="inline-flex items-center gap-2 rounded-full border border-primary/15 bg-primary/8 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-primary">
                      <BusFront className="h-3.5 w-3.5" />
                      {departure.corridorCode}
                    </div>
                    <h2 className="text-lg font-semibold tracking-tight text-foreground">{departure.corridorName}</h2>
                    <p className="text-sm text-muted-foreground">
                      {departure.originLabel} to {departure.destinationLabel}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatDepartureTime(departure.departureTime)} • Bay {departure.boardingBay}
                      {departure.vehicleLabel ? ` • ${departure.vehicleLabel}` : ''}
                    </p>
                  </div>
                  <span className={cn('inline-flex rounded-full border px-3 py-1 text-[11px] font-medium', getDepartureTone(departure.status))}>
                    {departure.status}
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-2 text-xs">
                  <PassengerMetricPill label="Capacity" value={`${departure.seatCapacity}`} />
                  <PassengerMetricPill label="Open seats" value={`${departure.availableSeats}`} />
                  <PassengerMetricPill label="Fare" value={formatCurrency(departure.baseFare)} />
                </div>

                <div className="rounded-[1.45rem] border border-border/60 bg-card/75">
                  <div className="flex items-center justify-between gap-3 border-b border-border/55 px-4 py-3">
                    <div>
                      <p className="text-sm font-semibold text-foreground">Passenger manifest</p>
                      <p className="text-xs text-muted-foreground">
                        Confirm boarded passengers and keep no-shows off the completed run.
                      </p>
                    </div>
                    <span className="text-xs text-muted-foreground">{departure.reservations.length} booked</span>
                  </div>
                  {departure.reservations.length ? (
                    <div className="divide-y divide-border/55">
                      {departure.reservations.map((reservation) => (
                        <div key={reservation.id} className="space-y-3 px-4 py-4">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-semibold text-foreground">{reservation.passenger?.name ?? 'Passenger'}</p>
                              <p className="text-xs text-muted-foreground">
                                {reservation.bookingReference} • {reservation.seatCount} seat
                                {reservation.seatCount > 1 ? 's' : ''}
                                {reservation.passenger?.phone ? ` • ${reservation.passenger.phone}` : ''}
                              </p>
                            </div>
                            <span className={cn('inline-flex rounded-full border px-3 py-1 text-[11px] font-medium', getDepartureTone(reservation.status === 'confirmed' ? 'scheduled' : reservation.status === 'boarded' ? 'boarding' : reservation.status === 'completed' ? 'completed' : 'cancelled'))}>
                              {reservation.status}
                            </span>
                          </div>

                          <div className="flex flex-wrap gap-2">
                            {reservation.status === 'confirmed' ? (
                              <>
                                <Button
                                  className="h-9 rounded-full"
                                  disabled={reservationActionId === `${reservation.id}:board`}
                                  onClick={() => void handleReservationAction(reservation.id, 'board')}
                                >
                                  <CheckCircle2 className="mr-2 h-4 w-4" />
                                  {reservationActionId === `${reservation.id}:board` ? 'Boarding...' : 'Mark boarded'}
                                </Button>
                                <Button
                                  variant="outline"
                                  className="h-9 rounded-full"
                                  disabled={reservationActionId === `${reservation.id}:no_show`}
                                  onClick={() => void handleReservationAction(reservation.id, 'no_show')}
                                >
                                  <UserRoundX className="mr-2 h-4 w-4" />
                                  No-show
                                </Button>
                              </>
                            ) : null}
                            {reservation.status === 'boarded' ? (
                              <Button
                                variant="outline"
                                className="h-9 rounded-full"
                                disabled={reservationActionId === `${reservation.id}:complete`}
                                onClick={() => void handleReservationAction(reservation.id, 'complete')}
                              >
                                <ArrowRightLeft className="mr-2 h-4 w-4" />
                                {reservationActionId === `${reservation.id}:complete` ? 'Closing...' : 'Complete rider'}
                              </Button>
                            ) : null}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="px-4 py-6 text-sm text-muted-foreground">No passengers are booked on this departure yet.</div>
                  )}
                </div>

                <div className="flex flex-wrap gap-2">
                  {primaryAction ? (
                    <Button
                      className="h-11 rounded-full"
                      disabled={departureActionId === `${departure.id}:${primaryAction.action}`}
                      onClick={() => void handleDepartureAction(departure.id, primaryAction.action)}
                    >
                      {departureActionId === `${departure.id}:${primaryAction.action}` ? 'Updating...' : primaryAction.label}
                    </Button>
                  ) : null}
                  {departure.status === 'scheduled' || departure.status === 'boarding' ? (
                    <Button
                      variant="outline"
                      className="h-11 rounded-full"
                      disabled={departureActionId === `${departure.id}:cancel`}
                      onClick={() => void handleDepartureAction(departure.id, 'cancel')}
                    >
                      Cancel departure
                    </Button>
                  ) : null}
                  {index === 0 ? (
                    <Link href="/driver/assigned" className="flex-1 min-w-[10rem]">
                      <Button variant="ghost" className="h-11 w-full rounded-full">Open Assigned</Button>
                    </Link>
                  ) : null}
                </div>
              </section>
            );
          })}
        </div>
      ) : (
        <section className="rounded-[1.85rem] border border-border/60 bg-background/58 px-4 py-8 text-center">
          <Users className="mx-auto h-8 w-8 text-primary" />
          <p className="mt-3 text-sm font-semibold text-foreground">No P2P departures assigned</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Once tenant operations assigns you to a direct trip, it will appear here with its boarding list and next actions.
          </p>
        </section>
      )}

      <section className="rounded-[1.7rem] border border-border/60 bg-background/60 px-4 py-4">
        <div className="flex items-start gap-3">
          <div className="rounded-full border border-primary/20 bg-primary/10 p-2 text-primary">
            <CalendarClock className="h-4 w-4" />
          </div>
          <div className="space-y-1">
            <p className="text-sm font-medium text-foreground">Driver story</p>
            <p className="text-sm text-muted-foreground">
              P2P work is schedule-based. You are not waiting for street-side ride matching here; you are operating a published departure with a fixed manifest and bay.
            </p>
          </div>
        </div>
      </section>
    </DriverAppShell>
  );
}
