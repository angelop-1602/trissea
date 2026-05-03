'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  ArrowRight,
  CalendarClock,
  Clock3,
  MapPinned,
  Navigation,
  ReceiptText,
  Route,
  UserRound,
} from 'lucide-react';
import type { Reservation } from '@prisma/client';
import { RideFeedbackCard } from '@/components/ride/ride-feedback-card';
import { useStore } from '@/lib/store-context';
import { PassengerAppShell } from '@/components/passenger/passenger-app-shell';
import { InlineErrorState, PageLoadingState } from '@/components/page-state';
import { StatusBadge } from '@/components/status-badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PassengerMetricPill } from '@/components/passenger/passenger-surfaces';
import { getMyTodaReservations, submitRideFeedback, type ReservationWithTerminal } from '@/lib/booking/client';
import { useBookingRealtime } from '@/hooks/use-booking-realtime';
import {
  getPassengerHistoryData,
  type PassengerHistoryData,
  type PassengerHistoryRide,
  type RideFeedbackSummary,
} from '@/lib/dashboard/client';
import { cn } from '@/lib/utils';

type ActivityTab = 'trips' | 'reservations';
type StateFilter = 'active' | 'completed' | 'cancelled';

const STATE_FILTERS: StateFilter[] = ['active', 'completed', 'cancelled'];

const TRIP_FILTER_LABELS: Record<StateFilter, string> = {
  active: 'Active',
  completed: 'Completed',
  cancelled: 'Cancelled',
};

const RESERVATION_FILTER_LABELS: Record<StateFilter, string> = {
  active: 'Active',
  completed: 'Completed',
  cancelled: 'Cancelled',
};

function formatCurrency(value: number) {
  return new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: 'PHP',
    maximumFractionDigits: 0,
  }).format(value);
}

function formatDateTime(value: string | Date | null | undefined) {
  if (!value) return null;

  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;

  return new Intl.DateTimeFormat('en-PH', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
}

function getRideFilterMatches(ride: PassengerHistoryRide, filter: StateFilter) {
  if (filter === 'active') {
    return ['searching', 'matched', 'en_route', 'arrived', 'in_trip'].includes(ride.status);
  }

  if (filter === 'completed') {
    return ride.status === 'completed';
  }

  return ride.status === 'cancelled';
}

function getReservationFilterMatches(reservation: Reservation, filter: StateFilter) {
  if (filter === 'active') {
    return reservation.status === 'confirmed' || reservation.status === 'arrived';
  }

  if (filter === 'completed') {
    return reservation.status === 'completed';
  }

  return reservation.status === 'cancelled';
}

function ActivitySectionTitle({
  title,
  description,
  trailing,
}: {
  title: string;
  description?: string;
  trailing?: ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-3 px-1">
      <div className="min-w-0 space-y-1">
        <h2 className="text-sm font-semibold tracking-tight text-foreground">{title}</h2>
        {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
      </div>
      {trailing ? <div className="shrink-0">{trailing}</div> : null}
    </div>
  );
}

function FilterChips({
  value,
  onChange,
  labels,
  counts,
}: {
  value: StateFilter;
  onChange: (value: StateFilter) => void;
  labels: Record<StateFilter, string>;
  counts: Record<StateFilter, number>;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {STATE_FILTERS.map((key) => {
        const isActive = key === value;

        return (
          <Button
            key={key}
            type="button"
            variant={isActive ? 'default' : 'outline'}
            className="h-9 rounded-full px-3.5 text-xs"
            aria-pressed={isActive}
            aria-label={`${labels[key]} ${counts[key]} ${counts[key] === 1 ? 'record' : 'records'}`}
            onClick={() => onChange(key)}
          >
            <span>{labels[key]}</span>
            <span
              className={cn(
                'ml-1.5 inline-flex min-w-5 items-center justify-center rounded-full px-1.5 py-0.5 text-[10px] font-semibold leading-none',
                isActive ? 'bg-primary-foreground/20 text-primary-foreground' : 'bg-primary/10 text-primary'
              )}
            >
              {counts[key]}
            </span>
          </Button>
        );
      })}
    </div>
  );
}

function ActivityEmptyState({
  title,
  description,
  actionHref,
  actionLabel,
}: {
  title: string;
  description: string;
  actionHref: string;
  actionLabel: string;
}) {
  return (
    <div className="space-y-3 rounded-[1.85rem] border border-border/60 bg-background/58 px-4 py-8 text-center">
      <p className="text-sm font-medium">{title}</p>
      <p className="text-sm text-muted-foreground">{description}</p>
      <Link href={actionHref}>
        <Button variant="outline" className="rounded-full">
          {actionLabel}
        </Button>
      </Link>
    </div>
  );
}

function TripRow({
  ride,
  active,
  onFeedbackSaved,
}: {
  ride: PassengerHistoryRide;
  active: boolean;
  onFeedbackSaved: (rideId: string, feedback: RideFeedbackSummary) => void;
}) {
  const primaryTime =
    (ride.status === 'completed' ? formatDateTime(ride.completedAt) : null) ??
    formatDateTime(ride.updatedAt) ??
    formatDateTime(ride.createdAt);

  return (
    <div className="space-y-3 px-4 py-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
            {active ? 'Current trip' : 'Trip record'}
          </p>
          <h3 className="mt-1 truncate text-sm font-semibold leading-tight">{ride.pickupLocation}</h3>
          <p className="mt-1 flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
            <ArrowRight className="h-3.5 w-3.5 shrink-0 text-primary" />
            <span className="truncate">{ride.dropoffLocation}</span>
          </p>
        </div>
        <StatusBadge status={ride.status} className="shrink-0" />
      </div>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-xs text-muted-foreground">
        {primaryTime ? (
          <span className="inline-flex min-w-0 items-center gap-1.5">
            <CalendarClock className="h-3.5 w-3.5 shrink-0 text-primary" />
            <span className="truncate">{primaryTime}</span>
          </span>
        ) : null}
        {ride.driver ? (
          <span className="inline-flex min-w-0 items-center gap-1.5">
            <UserRound className="h-3.5 w-3.5 shrink-0 text-primary" />
            <span className="truncate">
              Driver: {ride.driver.name}
              {ride.driver.rating != null ? ` | ${ride.driver.rating.toFixed(1)} stars` : ''}
            </span>
          </span>
        ) : null}
      </div>

      <div className="grid grid-cols-3 gap-2 text-xs">
        <PassengerMetricPill
          label="Distance"
          className="min-w-0"
          value={
            <span className="inline-flex min-w-0 items-center justify-center gap-1">
              <Navigation className="h-3.5 w-3.5 shrink-0 text-primary" />
              <span className="truncate">{ride.distance} km</span>
            </span>
          }
        />
        <PassengerMetricPill
          label="ETA"
          className="min-w-0"
          value={
            <span className="inline-flex min-w-0 items-center justify-center gap-1">
              <Clock3 className="h-3.5 w-3.5 shrink-0 text-primary" />
              <span className="truncate">{ride.estimatedDuration} min</span>
            </span>
          }
        />
        <PassengerMetricPill
          label="Fare"
          className="min-w-0"
          value={
            <span className="inline-flex min-w-0 items-center justify-center gap-1">
              <ReceiptText className="h-3.5 w-3.5 shrink-0 text-primary" />
              <span className="truncate">{formatCurrency(ride.fare)}</span>
            </span>
          }
        />
      </div>

      <div className="flex justify-end">
        {active ? (
          <Link href="/passenger/on-demand">
            <Button variant="ghost" size="sm" className="h-8 rounded-full px-3 text-xs">
              Resume trip
            </Button>
          </Link>
        ) : null}
      </div>

      {ride.status === 'completed' ? (
        <RideFeedbackCard
          title={ride.viewerFeedback ? 'Your feedback for this trip' : 'Rate your driver'}
          subjectLabel="Driver"
          subjectName={ride.driver?.name ?? null}
          existingFeedback={ride.viewerFeedback}
          className="border-border/55 bg-background/50 shadow-none"
          onSubmit={async (input) => {
            const response = await submitRideFeedback(ride.id, input);
            onFeedbackSaved(ride.id, response.feedback);
          }}
        />
      ) : null}
    </div>
  );
}

function ReservationRow({
  reservation,
  active,
}: {
  reservation: ReservationWithTerminal;
  active: boolean;
}) {
  const primaryTime =
    formatDateTime(reservation.boardingTime) ??
    formatDateTime(reservation.updatedAt) ??
    formatDateTime(reservation.createdAt);

  return (
    <div className="space-y-3 px-4 py-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
            {active ? 'Active reservation' : 'Reservation record'}
          </p>
          <h3 className="mt-1 truncate text-sm font-semibold leading-tight">{reservation.TODATerminal.name}</h3>
          <p className="mt-1 flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
            <MapPinned className="h-3.5 w-3.5 shrink-0 text-primary" />
            <span className="truncate">{reservation.TODATerminal.location}</span>
          </p>
        </div>
        <StatusBadge status={reservation.status} className="shrink-0" />
      </div>

      <div className="grid grid-cols-2 gap-2 text-xs">
        <PassengerMetricPill
          label="Queue"
          className="min-w-0"
          value={
            <span className="inline-flex min-w-0 items-center justify-center gap-1">
              <Route className="h-3.5 w-3.5 shrink-0 text-primary" />
              <span className="truncate">#{reservation.queuePosition}</span>
            </span>
          }
        />
        <PassengerMetricPill
          label="Boarding"
          className="min-w-0"
          value={
            <span className="inline-flex min-w-0 items-center justify-center gap-1">
              <CalendarClock className="h-3.5 w-3.5 shrink-0 text-primary" />
              <span className="truncate">{primaryTime ?? 'Queue now'}</span>
            </span>
          }
        />
      </div>

      <div className="flex items-center justify-between gap-3">
        <span className="min-w-0 truncate text-xs text-muted-foreground">{primaryTime ?? 'Queue now'}</span>
        {active ? (
          <Link href="/passenger/toda">
            <Button variant="ghost" size="sm" className="h-8 rounded-full px-3 text-xs">
              Manage reservation
            </Button>
          </Link>
        ) : null}
      </div>
    </div>
  );
}

export default function PassengerActivityPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { currentUser } = useStore();
  const [historyData, setHistoryData] = useState<PassengerHistoryData | null>(null);
  const [reservations, setReservations] = useState<ReservationWithTerminal[]>([]);
  const [tripFilter, setTripFilter] = useState<StateFilter>('active');
  const [reservationFilter, setReservationFilter] = useState<StateFilter>('active');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const loadingRef = useRef(false);

  const canLoad = currentUser?.role === 'passenger';
  const activeTab: ActivityTab = searchParams.get('tab') === 'reservations' ? 'reservations' : 'trips';

  const loadActivity = useCallback(async () => {
    if (!canLoad || loadingRef.current) return;

    loadingRef.current = true;
    try {
      const [rideResponse, reservationResponse] = await Promise.all([
        getPassengerHistoryData(),
        getMyTodaReservations(),
      ]);
      setHistoryData(rideResponse);
      setReservations(reservationResponse.reservations);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load activity.');
    } finally {
      loadingRef.current = false;
      setLoading(false);
    }
  }, [canLoad]);

  useEffect(() => {
    void loadActivity();
  }, [loadActivity]);

  useBookingRealtime({
    enabled: Boolean(canLoad),
    onUpdate: (payload) => {
      if (payload.type === 'ride.updated' || payload.type === 'reservation.updated') {
        void loadActivity();
      }
    },
  });

  const rides = historyData?.rides ?? [];

  const handleTabChange = useCallback(
    (value: string) => {
      const nextTab: ActivityTab = value === 'reservations' ? 'reservations' : 'trips';
      const nextParams = new URLSearchParams(searchParams.toString());
      nextParams.set('tab', nextTab);
      router.replace(`/passenger/activity?${nextParams.toString()}`, { scroll: false });
    },
    [router, searchParams]
  );

  const handleFeedbackSaved = useCallback((rideId: string, feedback: RideFeedbackSummary) => {
    setHistoryData((current) => {
      if (!current) return current;

      return {
        ...current,
        rides: current.rides.map((ride) =>
          ride.id === rideId
            ? {
                ...ride,
                viewerFeedback: feedback,
              }
            : ride
        ),
      };
    });
  }, []);

  const tripFilterCounts = useMemo(
    () => ({
      active: rides.filter((ride) => getRideFilterMatches(ride, 'active')).length,
      completed: rides.filter((ride) => getRideFilterMatches(ride, 'completed')).length,
      cancelled: rides.filter((ride) => getRideFilterMatches(ride, 'cancelled')).length,
    }),
    [rides]
  );

  const reservationFilterCounts = useMemo(
    () => ({
      active: reservations.filter((reservation) => getReservationFilterMatches(reservation, 'active')).length,
      completed: reservations.filter((reservation) => getReservationFilterMatches(reservation, 'completed')).length,
      cancelled: reservations.filter((reservation) => getReservationFilterMatches(reservation, 'cancelled')).length,
    }),
    [reservations]
  );

  const filteredTrips = useMemo(
    () => rides.filter((ride) => getRideFilterMatches(ride, tripFilter)),
    [rides, tripFilter]
  );

  const filteredReservations = useMemo(
    () => reservations.filter((reservation) => getReservationFilterMatches(reservation, reservationFilter)),
    [reservations, reservationFilter]
  );

  if (!currentUser || currentUser.role !== 'passenger' || loading) {
    return (
      <PageLoadingState
        label="Loading passenger activity..."
        tone="passenger"
      />
    );
  }

  return (
    <PassengerAppShell
      title="Activity"
      subtitle="Trips and reservations in one place."
      topContext="Activity"
      headerVariant="compact"
      headerSurface="minimal"
    >
      {error ? <InlineErrorState message={error} onRetry={() => void loadActivity()} /> : null}

      <Tabs value={activeTab} onValueChange={handleTabChange} className="space-y-4">
        <TabsList className="grid h-12 w-full grid-cols-2 rounded-[1.4rem] border border-border/60 bg-background/58 p-1">
          <TabsTrigger value="trips" className="rounded-[1rem]">
            <span className="inline-flex items-center gap-2">
              <span>Trips</span>
              <span className="inline-flex min-w-5 items-center justify-center rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold leading-none text-primary">
                {rides.length}
              </span>
            </span>
          </TabsTrigger>
          <TabsTrigger value="reservations" className="rounded-[1rem]">
            <span className="inline-flex items-center gap-2">
              <span>Reservations</span>
              <span className="inline-flex min-w-5 items-center justify-center rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold leading-none text-primary">
                {reservations.length}
              </span>
            </span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="trips" className="space-y-4">
          <ActivitySectionTitle
            title="Trips"
            description="Current rides and trip records in one place."
            trailing={
              <span className="rounded-full border border-border/60 bg-background/60 px-3 py-1.5 text-[11px] text-muted-foreground">
                {filteredTrips.length} shown
              </span>
            }
          />
          <FilterChips
            value={tripFilter}
            onChange={setTripFilter}
            labels={TRIP_FILTER_LABELS}
            counts={tripFilterCounts}
          />

          {filteredTrips.length === 0 ? (
            <ActivityEmptyState
              title={
                tripFilter === 'active'
                  ? 'No active trips'
                  : tripFilter === 'completed'
                    ? 'No completed trips yet'
                    : 'No cancelled trips yet'
              }
              description={
                tripFilter === 'active'
                  ? 'Book a ride when you need immediate pickup.'
                  : tripFilter === 'completed'
                    ? 'Completed trip records will appear here once you finish a ride.'
                    : 'Cancelled trips will appear here if a ride is cancelled before completion.'
              }
              actionHref="/passenger/on-demand"
              actionLabel="Book ride"
            />
          ) : (
            <div className="divide-y divide-border/55 overflow-hidden rounded-[1.9rem] border border-border/60 bg-background/58">
              {filteredTrips.map((ride) => (
                <TripRow
                  key={ride.id}
                  ride={ride}
                  active={getRideFilterMatches(ride, 'active')}
                  onFeedbackSaved={handleFeedbackSaved}
                />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="reservations" className="space-y-4">
          <ActivitySectionTitle
            title="Reservations"
            description="Queue-based TODA reservations, kept separate from on-demand rides."
            trailing={
              <span className="rounded-full border border-border/60 bg-background/60 px-3 py-1.5 text-[11px] text-muted-foreground">
                {filteredReservations.length} shown
              </span>
            }
          />
          <FilterChips
            value={reservationFilter}
            onChange={setReservationFilter}
            labels={RESERVATION_FILTER_LABELS}
            counts={reservationFilterCounts}
          />

          {filteredReservations.length === 0 ? (
            <ActivityEmptyState
              title={
                reservationFilter === 'active'
                  ? 'No active reservations'
                  : reservationFilter === 'completed'
                    ? 'No completed reservations yet'
                    : 'No cancelled reservations yet'
              }
              description={
                reservationFilter === 'active'
                  ? 'Reserve from a TODA terminal when you want a queue slot.'
                  : reservationFilter === 'completed'
                    ? 'Completed TODA reservations will appear here after terminal boarding is finished.'
                    : 'Cancelled TODA reservations will appear here once you cancel a confirmed queue slot.'
              }
              actionHref="/passenger/toda"
              actionLabel="Open TODA"
            />
          ) : (
            <div className="divide-y divide-border/55 overflow-hidden rounded-[1.9rem] border border-border/60 bg-background/58">
              {filteredReservations.map((reservation) => (
                <ReservationRow
                  key={reservation.id}
                  reservation={reservation}
                  active={reservationFilter === 'active'}
                />
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </PassengerAppShell>
  );
}
