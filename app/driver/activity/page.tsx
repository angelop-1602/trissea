'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { CalendarClock, Clock3, DollarSign, Navigation } from 'lucide-react';
import type { Ride } from '@prisma/client';
import { DriverAppShell } from '@/components/driver/driver-app-shell';
import { InlineErrorState, PageLoadingState } from '@/components/page-state';
import { RideFeedbackCard } from '@/components/ride/ride-feedback-card';
import { StatusBadge } from '@/components/status-badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useBookingRealtime } from '@/hooks/use-booking-realtime';
import { submitRideFeedback } from '@/lib/booking/client';
import {
  getDriverEarningsData,
  getDriverHistoryData,
  type DriverHistoryRide,
  type DriverEarningsData,
  type DriverHistoryData,
  type RideFeedbackSummary,
} from '@/lib/dashboard/client';
import { useStore } from '@/lib/store-context';

type ActivityTab = 'trips' | 'earnings';
type TripFilter = 'all' | 'completed' | 'cancelled';

const TRIP_FILTER_LABELS: Record<TripFilter, string> = {
  all: 'All',
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

function getHistoricalTripTimestamp(ride: DriverHistoryRide) {
  if (ride.status === 'completed') {
    return formatDateTime(ride.completedAt) ?? formatDateTime(ride.updatedAt);
  }

  return formatDateTime(ride.updatedAt) ?? formatDateTime(ride.createdAt);
}

function matchesTripFilter(ride: DriverHistoryRide, filter: TripFilter) {
  if (filter === 'all') {
    return ride.status === 'completed' || ride.status === 'cancelled';
  }

  return ride.status === filter;
}

function ActivitySummaryPill({
  label,
  value,
  tone = 'default',
}: {
  label: string;
  value: React.ReactNode;
  tone?: 'default' | 'success';
}) {
  return (
    <div className="rounded-[1.25rem] border border-border/60 bg-background/60 px-3 py-3">
      <p className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
        {label}
      </p>
      <div
        className={`mt-1 text-sm font-semibold ${
          tone === 'success' ? 'text-primary' : 'text-foreground'
        }`}
      >
        {value}
      </div>
    </div>
  );
}

function ActivitySectionTitle({
  title,
  description,
  trailing,
}: {
  title: string;
  description: string;
  trailing?: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-3 px-1">
      <div className="space-y-1">
        <h2 className="text-sm font-semibold tracking-tight text-foreground">
          {title}
        </h2>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      {trailing}
    </div>
  );
}

function FilterChips({
  value,
  onChange,
}: {
  value: TripFilter;
  onChange: (value: TripFilter) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {(Object.keys(TRIP_FILTER_LABELS) as TripFilter[]).map((key) => {
        const active = key === value;

        return (
          <Button
            key={key}
            type="button"
            variant={active ? 'default' : 'outline'}
            className="h-9 rounded-full px-4 text-xs"
            onClick={() => onChange(key)}
          >
            {TRIP_FILTER_LABELS[key]}
          </Button>
        );
      })}
    </div>
  );
}

function ActivityEmptyState({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="space-y-3 rounded-[1.85rem] border border-dashed border-border/70 bg-background/52 px-4 py-8 text-center">
      <p className="text-sm font-medium">{title}</p>
      <p className="text-sm text-muted-foreground">{description}</p>
      <Link href="/driver/assigned">
        <Button variant="outline" className="rounded-full">
          Open Assigned
        </Button>
      </Link>
    </div>
  );
}

function TripHistoryRow({
  ride,
  onFeedbackSaved,
}: {
  ride: DriverHistoryRide;
  onFeedbackSaved: (rideId: string, feedback: RideFeedbackSummary) => void;
}) {
  const loggedAt = getHistoricalTripTimestamp(ride);

  return (
    <div className="space-y-3 px-4 py-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <p className="text-sm font-medium">{ride.pickupLocation}</p>
          <p className="text-xs text-muted-foreground">
            to {ride.dropoffLocation}
          </p>
        </div>
        <StatusBadge status={ride.status} />
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-muted-foreground">
        {loggedAt ? (
          <span className="inline-flex items-center gap-1.5">
            <CalendarClock className="h-3.5 w-3.5 text-primary" />
            {loggedAt}
          </span>
        ) : null}
        <span className="inline-flex items-center gap-1.5">
          <Navigation className="h-3.5 w-3.5 text-primary" />
          {ride.distance} km
        </span>
        <span className="inline-flex items-center gap-1.5">
          <DollarSign className="h-3.5 w-3.5 text-primary" />
          {formatCurrency(ride.fare)}
        </span>
        <span>Passenger: {ride.passenger.name}</span>
      </div>

      {ride.status === 'completed' ? (
        <RideFeedbackCard
          title={ride.viewerFeedback ? 'Your passenger feedback' : 'Rate your passenger'}
          subjectLabel="Passenger"
          subjectName={ride.passenger.name}
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

function EarningsRow({ ride }: { ride: Ride }) {
  const completedAt = formatDateTime(ride.completedAt) ?? formatDateTime(ride.updatedAt);

  return (
    <div className="space-y-3 px-4 py-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <p className="text-sm font-medium">{ride.pickupLocation}</p>
          <p className="text-xs text-muted-foreground">
            to {ride.dropoffLocation}
          </p>
        </div>
        <div className="text-right">
          <p className="text-sm font-semibold text-primary">
            {formatCurrency(ride.fare)}
          </p>
          <p className="text-[11px] text-muted-foreground">Gross fare</p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-muted-foreground">
        {completedAt ? (
          <span className="inline-flex items-center gap-1.5">
            <CalendarClock className="h-3.5 w-3.5 text-primary" />
            {completedAt}
          </span>
        ) : null}
        <span className="inline-flex items-center gap-1.5">
          <Navigation className="h-3.5 w-3.5 text-primary" />
          {ride.distance} km
        </span>
        <span className="inline-flex items-center gap-1.5">
          <Clock3 className="h-3.5 w-3.5 text-primary" />
          {ride.estimatedDuration} min
        </span>
      </div>
    </div>
  );
}

function ActivityList({ children }: { children: React.ReactNode }) {
  return (
    <div className="divide-y divide-border/50 overflow-hidden rounded-[1.85rem] border border-border/60 bg-background/58">
      {children}
    </div>
  );
}

export default function DriverActivityPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { currentUser } = useStore();
  const [historyData, setHistoryData] = useState<DriverHistoryData | null>(
    null,
  );
  const [earningsData, setEarningsData] = useState<DriverEarningsData | null>(
    null,
  );
  const [tripFilter, setTripFilter] = useState<TripFilter>('all');
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const loadingRef = useRef(false);

  const canLoad = currentUser?.role === 'driver';
  const activeTab: ActivityTab =
    searchParams.get('tab') === 'earnings' ? 'earnings' : 'trips';

  const loadActivity = useCallback(
    async (options?: { silent?: boolean }) => {
      if (!canLoad || loadingRef.current) return;

      const silent = options?.silent ?? false;
      loadingRef.current = true;
      if (silent) {
        setIsRefreshing(true);
      }

      try {
        const [historyResponse, earningsResponse] = await Promise.all([
          getDriverHistoryData(),
          getDriverEarningsData(),
        ]);

        setHistoryData(historyResponse);
        setEarningsData(earningsResponse);
        setError(null);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : 'Failed to load driver activity.',
        );
      } finally {
        loadingRef.current = false;
        setLoading(false);
        setIsRefreshing(false);
      }
    },
    [canLoad],
  );

  useEffect(() => {
    void loadActivity();
  }, [loadActivity]);

  useBookingRealtime({
    enabled: Boolean(canLoad),
    onUpdate: (payload) => {
      if (payload.type === 'ride.updated') {
        void loadActivity({ silent: true });
      }
    },
  });

  const handleTabChange = useCallback(
    (value: string) => {
      const nextTab: ActivityTab = value === 'earnings' ? 'earnings' : 'trips';
      const nextParams = new URLSearchParams(searchParams.toString());
      nextParams.set('tab', nextTab);
      router.replace(`/driver/activity?${nextParams.toString()}`, {
        scroll: false,
      });
    },
    [router, searchParams],
  );

  const allRides = historyData?.rides ?? [];
  const historicalRides = useMemo(
    () =>
      allRides.filter(
        (ride) => ride.status === 'completed' || ride.status === 'cancelled',
      ),
    [allRides],
  );
  const filteredTrips = useMemo(
    () => historicalRides.filter((ride) => matchesTripFilter(ride, tripFilter)),
    [historicalRides, tripFilter],
  );
  const completedRides = earningsData?.completedRides ?? [];
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

  if (!currentUser || currentUser.role !== 'driver' || loading) {
    return (
      <PageLoadingState
        label="Loading driver activity..."
        className="theme-driver min-h-screen bg-background text-foreground"
      />
    );
  }

  const historyStats = historyData?.stats ?? {
    totalRides: 0,
    completedRides: 0,
    cancelledRides: 0,
    totalEarnings: 0,
  };
  const earningsStats = earningsData?.stats ?? {
    totalEarnings: 0,
    averageRideEarnings: 0,
    completedRides: 0,
  };

  return (
    <DriverAppShell>
      {error ? (
        <InlineErrorState message={error} onRetry={() => void loadActivity()} />
      ) : null}

      <Tabs
        value={activeTab}
        onValueChange={handleTabChange}
        className="space-y-4"
      >
        <TabsList className="grid h-12 w-full grid-cols-2 rounded-[1.4rem] border border-border/60 bg-background/58 p-1">
          <TabsTrigger value="trips" className="rounded-[1rem]">
            Trips
          </TabsTrigger>
          <TabsTrigger value="earnings" className="rounded-[1rem]">
            Earnings
          </TabsTrigger>
        </TabsList>

        <TabsContent value="trips" className="space-y-4">
          <ActivitySectionTitle
            title="Trips"
            description="Completed and cancelled rides linked to your driver account."
            trailing={
              <span className="rounded-full border border-border/60 bg-background/60 px-3 py-1.5 text-[11px] text-muted-foreground">
                {isRefreshing ? 'Refreshing...' : 'Ride log'}
              </span>
            }
          />

          <FilterChips value={tripFilter} onChange={setTripFilter} />

          <div className="grid grid-cols-3 gap-2 text-xs">
            <ActivitySummaryPill
              label="Completed"
              value={historyStats.completedRides}
            />
            <ActivitySummaryPill
              label="Cancelled"
              value={historyStats.cancelledRides}
            />
            <ActivitySummaryPill
              label="Gross fares"
              value={formatCurrency(historyStats.totalEarnings)}
              tone="success"
            />
          </div>

          {filteredTrips.length === 0 ? (
            <ActivityEmptyState
              title={
                tripFilter === 'completed'
                  ? 'No completed trips yet'
                  : tripFilter === 'cancelled'
                    ? 'No cancelled trips yet'
                    : 'No trip activity yet'
              }
              description={
                tripFilter === 'cancelled'
                  ? 'Cancelled rides will appear here when they are linked to your driver account.'
                  : 'Completed and cancelled trip records will appear here after live work is finished.'
              }
            />
          ) : (
            <ActivityList>
              {filteredTrips.map((ride) => (
                <TripHistoryRow key={ride.id} ride={ride} onFeedbackSaved={handleFeedbackSaved} />
              ))}
            </ActivityList>
          )}
        </TabsContent>

        <TabsContent value="earnings" className="space-y-4">
          <ActivitySectionTitle
            title="Earnings"
            description="Gross fare totals from completed trips only. Payouts and settlements are not tracked here."
            trailing={
              <span className="rounded-full border border-primary/15 bg-primary/10 px-3 py-1.5 text-[11px] text-primary">
                Gross fare only
              </span>
            }
          />

          <div className="grid grid-cols-3 gap-2 text-xs">
            <ActivitySummaryPill
              label="Gross fare total"
              value={formatCurrency(earningsStats.totalEarnings)}
              tone="success"
            />
            <ActivitySummaryPill
              label="Avg per trip"
              value={formatCurrency(
                Math.round(earningsStats.averageRideEarnings),
              )}
            />
            <ActivitySummaryPill
              label="Completed rides"
              value={earningsStats.completedRides}
            />
          </div>

          {completedRides.length === 0 ? (
            <ActivityEmptyState
              title="No completed trips yet"
              description="Completed trip fares will appear here after you finish assigned rides."
            />
          ) : (
            <ActivityList>
              {completedRides.map((ride) => (
                <EarningsRow key={ride.id} ride={ride} />
              ))}
            </ActivityList>
          )}
        </TabsContent>
      </Tabs>
    </DriverAppShell>
  );
}
