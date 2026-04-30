'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { CalendarClock, Clock3, MapPinned, Navigation, Route } from 'lucide-react';
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

type ActivityTab = 'trips' | 'reservations';
type StateFilter = 'active' | 'completed' | 'cancelled';

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
}: {
  title: string;
  description?: string;
}) {
  return (
    <div className="space-y-1 px-1">
      <h2 className="text-sm font-semibold tracking-tight text-foreground">{title}</h2>
      {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
    </div>
  );
}

function FilterChips({
  value,
  onChange,
  labels,
}: {
  value: StateFilter;
  onChange: (value: StateFilter) => void;
  labels: Record<StateFilter, string>;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {(Object.keys(labels) as StateFilter[]).map((key) => {
        const isActive = key === value;

        return (
          <Button
            key={key}
            type="button"
            variant={isActive ? 'default' : 'outline'}
            className="h-9 rounded-full px-4 text-xs"
            onClick={() => onChange(key)}
          >
            {labels[key]}
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
    <div className="space-y-4 px-4 py-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <p className="text-sm font-medium">{ride.pickupLocation}</p>
          <p className="text-xs text-muted-foreground">to {ride.dropoffLocation}</p>
        </div>
        <StatusBadge status={ride.status} />
      </div>

      <div className="grid grid-cols-3 gap-2 text-xs">
        <PassengerMetricPill
          label="Distance"
          value={
            <span className="inline-flex items-center gap-1">
              <Navigation className="h-3.5 w-3.5 text-primary" />
              {ride.distance} km
            </span>
          }
        />
        <PassengerMetricPill
          label="ETA"
          value={
            <span className="inline-flex items-center gap-1">
              <Clock3 className="h-3.5 w-3.5 text-primary" />
              {ride.estimatedDuration} min
            </span>
          }
        />
        <PassengerMetricPill
          label="Fare"
          value={
            <span className="inline-flex items-center gap-1">
              <MapPinned className="h-3.5 w-3.5 text-primary" />
              {formatCurrency(ride.fare)}
            </span>
          }
        />
      </div>

      <div className="flex items-center justify-between gap-3">
        <div className="space-y-1">
          {primaryTime ? <p className="text-xs text-muted-foreground">{primaryTime}</p> : null}
          {ride.driver ? (
            <p className="text-xs text-muted-foreground">
              Driver: {ride.driver.name}
              {ride.driver.rating != null ? ` · ${ride.driver.rating.toFixed(1)} stars` : ''}
            </p>
          ) : null}
        </div>
        {active ? (
          <Link href="/passenger/on-demand">
            <Button variant="ghost" size="sm" className="h-8 rounded-full px-3 text-xs">
              Resume Trip
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
    <div className="space-y-4 px-4 py-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <p className="text-sm font-medium">{reservation.TODATerminal.name}</p>
          <p className="text-xs text-muted-foreground">{reservation.TODATerminal.location}</p>
        </div>
        <StatusBadge status={reservation.status} />
      </div>

      <div className="grid grid-cols-2 gap-2 text-xs">
        <PassengerMetricPill
          label="Queue"
          value={
            <span className="inline-flex items-center gap-1">
              <Route className="h-3.5 w-3.5 text-primary" />
              #{reservation.queuePosition}
            </span>
          }
        />
        <PassengerMetricPill
          label="Boarding"
          value={
            <span className="inline-flex items-center gap-1">
              <CalendarClock className="h-3.5 w-3.5 text-primary" />
              {primaryTime ?? 'Queue now'}
            </span>
          }
        />
      </div>

      <div className="flex items-center justify-between gap-3">
        <span className="text-xs text-muted-foreground">{primaryTime ?? 'Queue now'}</span>
        {active ? (
          <Link href="/passenger/toda">
            <Button variant="ghost" size="sm" className="h-8 rounded-full px-3 text-xs">
              Manage Reservation
            </Button>
          </Link>
        ) : null}
      </div>
    </div>
  );
}

export default function PassengerActivityPage() {
  const { currentUser } = useStore();
  const [historyData, setHistoryData] = useState<PassengerHistoryData | null>(null);
  const [reservations, setReservations] = useState<ReservationWithTerminal[]>([]);
  const [activeTab, setActiveTab] = useState<ActivityTab>('trips');
  const [tripFilter, setTripFilter] = useState<StateFilter>('active');
  const [reservationFilter, setReservationFilter] = useState<StateFilter>('active');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const loadingRef = useRef(false);

  const canLoad = currentUser?.role === 'passenger';

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

      <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as ActivityTab)} className="space-y-4">
        <TabsList className="grid h-12 w-full grid-cols-2 rounded-[1.4rem] border border-border/60 bg-background/58 p-1">
          <TabsTrigger value="trips" className="rounded-[1rem]">
            Trips
          </TabsTrigger>
          <TabsTrigger value="reservations" className="rounded-[1rem]">
            Reservations
          </TabsTrigger>
        </TabsList>

        <TabsContent value="trips" className="space-y-4">
          <ActivitySectionTitle
            title="Trips"
            description="Current rides and ride history in one place."
          />
          <FilterChips value={tripFilter} onChange={setTripFilter} labels={TRIP_FILTER_LABELS} />

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
              actionLabel="Book Ride"
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
          />
          <FilterChips
            value={reservationFilter}
            onChange={setReservationFilter}
            labels={RESERVATION_FILTER_LABELS}
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
