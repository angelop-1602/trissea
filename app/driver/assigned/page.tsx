'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  AlertCircle,
  ArrowRight,
  Clock3,
  ListOrdered,
  MapPin,
  RefreshCw,
  Route,
} from 'lucide-react';
import type { Ride, RideStatus } from '@prisma/client';
import { useStore } from '@/lib/store-context';
import { DriverAppShell } from '@/components/driver/driver-app-shell';
import { StatusBadge } from '@/components/status-badge';
import { InlineErrorState, PageLoadingState } from '@/components/page-state';
import { Button } from '@/components/ui/button';
import { useBookingRealtime } from '@/hooks/use-booking-realtime';
import { getDriverAssignedRides } from '@/lib/booking/client';
import { cn } from '@/lib/utils';

const RIDE_PRIORITY: Record<string, number> = {
  in_trip: 0,
  arrived: 1,
  en_route: 2,
  matched: 3,
};

function formatCurrency(value: number) {
  return new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: 'PHP',
    maximumFractionDigits: 0,
  }).format(value);
}

function formatUpdatedAt(value: Date | null) {
  if (!value) return 'Waiting for assignments';

  return `Updated ${new Intl.DateTimeFormat('en-PH', {
    hour: 'numeric',
    minute: '2-digit',
  }).format(value)}`;
}

function getRidePriority(status: RideStatus) {
  return RIDE_PRIORITY[status] ?? 99;
}

function sortAssignedRides(rides: Ride[]) {
  return [...rides].sort((left, right) => {
    const byPriority = getRidePriority(left.status) - getRidePriority(right.status);
    if (byPriority !== 0) return byPriority;

    return new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime();
  });
}

function getAssignmentTitle(status: RideStatus) {
  switch (status) {
    case 'in_trip':
      return 'Trip is already in progress';
    case 'arrived':
      return 'Passenger pickup is ready';
    case 'en_route':
      return 'Head to pickup now';
    case 'matched':
      return 'New matched ride assigned';
    default:
      return 'Assigned ride';
  }
}

function getAssignmentDetail(status: RideStatus) {
  switch (status) {
    case 'in_trip':
      return 'Open Active to complete the trip once you reach the destination.';
    case 'arrived':
      return 'Open Active to start the trip when the passenger boards.';
    case 'en_route':
      return 'Open Active to continue to pickup and mark your arrival.';
    case 'matched':
      return 'Open Active to start heading to the pickup point.';
    default:
      return 'Open Active to continue the assigned workflow.';
  }
}

function getSectionDescription(status: RideStatus) {
  switch (status) {
    case 'in_trip':
    case 'arrived':
    case 'en_route':
      return 'This assignment already needs live trip action in Active.';
    case 'matched':
      return 'This matched ride is assigned to your account and ready for the next step.';
    default:
      return 'This assigned ride is ready in your active workflow.';
  }
}

function AssignedRideRow({
  ride,
  emphasis = 'default',
}: {
  ride: Ride;
  emphasis?: 'primary' | 'default';
}) {
  return (
    <div
      className={cn(
        'space-y-3 px-4 py-4',
        emphasis === 'primary' ? 'bg-primary/[0.04]' : 'bg-transparent',
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1 space-y-1">
          <p className="text-sm font-medium text-foreground">
            {getAssignmentTitle(ride.status)}
          </p>
          <p className="text-sm text-foreground">{ride.pickupLocation}</p>
          <p className="text-xs text-muted-foreground">
            to {ride.dropoffLocation}
          </p>
        </div>
        <StatusBadge status={ride.status} />
      </div>

      <div className="grid grid-cols-3 gap-2">
        <div className="rounded-[1rem] border border-border/50 bg-background/70 px-3 py-2">
          <p className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
            Distance
          </p>
          <p className="mt-1 text-sm font-medium text-foreground">
            {ride.distance} km
          </p>
        </div>
        <div className="rounded-[1rem] border border-border/50 bg-background/70 px-3 py-2">
          <p className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
            ETA
          </p>
          <p className="mt-1 text-sm font-medium text-foreground">
            {ride.estimatedDuration} min
          </p>
        </div>
        <div className="rounded-[1rem] border border-border/50 bg-background/70 px-3 py-2">
          <p className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
            Fare
          </p>
          <p className="mt-1 text-sm font-medium text-foreground">
            {formatCurrency(ride.fare)}
          </p>
        </div>
      </div>

      <div className="flex items-start gap-2 rounded-[1rem] border border-border/45 bg-background/70 px-3 py-3">
        <Route className="mt-0.5 h-4 w-4 text-primary" />
        <div className="space-y-0.5">
          <p className="text-sm font-medium text-foreground">Next action</p>
          <p className="text-xs leading-relaxed text-muted-foreground">
            {getAssignmentDetail(ride.status)}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <Link href="/driver/active-trip" className="flex-1 min-w-[10rem]">
          <Button className="h-11 w-full rounded-full">
            Open Active
            <ArrowRight className="ml-1 h-4 w-4" />
          </Button>
        </Link>
        <Link href="/driver/toda" className="flex-1 min-w-[10rem]">
          <Button variant="outline" className="h-11 w-full rounded-full">
            <ListOrdered className="mr-2 h-4 w-4" />
            Open TODA
          </Button>
        </Link>
      </div>
    </div>
  );
}

export default function DriverAssignedPage() {
  const { currentUser } = useStore();
  const [rides, setRides] = useState<Ride[]>([]);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<Date | null>(null);
  const [updateNotice, setUpdateNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const isLoadingRidesRef = useRef(false);
  const hasLoadedOnceRef = useRef(false);
  const previousRideIdsRef = useRef<string[]>([]);
  const noticeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isDriver = currentUser?.role === 'driver';

  const loadAssignedRides = useCallback(
    async (reason: 'initial' | 'manual' | 'realtime' = 'manual') => {
      if (!isDriver || isLoadingRidesRef.current) return;

      isLoadingRidesRef.current = true;
      if (reason !== 'initial') {
        setIsRefreshing(true);
      }

      try {
        const response = await getDriverAssignedRides();
        const nextRides = sortAssignedRides(response.rides);

        if (hasLoadedOnceRef.current) {
          const nextIds = nextRides.map((ride) => ride.id);
          const newAssignments = nextIds.filter(
            (rideId) => !previousRideIdsRef.current.includes(rideId),
          );

          if (newAssignments.length > 0) {
            if (noticeTimeoutRef.current) {
              clearTimeout(noticeTimeoutRef.current);
            }

            setUpdateNotice(
              `${newAssignments.length} new assigned ride${newAssignments.length === 1 ? '' : 's'} received`,
            );
            noticeTimeoutRef.current = setTimeout(() => {
              setUpdateNotice(null);
              noticeTimeoutRef.current = null;
            }, 5000);
          }

          previousRideIdsRef.current = nextIds;
        } else {
          previousRideIdsRef.current = nextRides.map((ride) => ride.id);
        }

        hasLoadedOnceRef.current = true;
        setRides(nextRides);
        setLastUpdatedAt(new Date());
        setError(null);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : 'Failed to load assigned rides.',
        );
      } finally {
        isLoadingRidesRef.current = false;
        setLoading(false);
        setIsRefreshing(false);
      }
    },
    [isDriver],
  );

  useEffect(() => {
    void loadAssignedRides('initial');

    return () => {
      if (noticeTimeoutRef.current) {
        clearTimeout(noticeTimeoutRef.current);
      }
    };
  }, [loadAssignedRides]);

  useBookingRealtime({
    enabled: Boolean(isDriver),
    onUpdate: (payload) => {
      if (payload.type === 'ride.updated') {
        void loadAssignedRides('realtime');
      }
    },
  });

  if (!currentUser || currentUser.role !== 'driver' || loading) {
    return (
      <PageLoadingState
        label="Loading assigned work..."
        className="theme-driver min-h-screen bg-background text-foreground"
      />
    );
  }

  const currentAssignment = rides[0] ?? null;
  const moreAssigned = rides.slice(1);

  return (
    <DriverAppShell>
      <div className="space-y-5">
        <section className="space-y-4 rounded-[2rem] border border-primary/15 bg-primary/[0.06] px-4 py-5">
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-1">
              <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                Assigned work
              </p>
              <h1 className="text-2xl font-semibold tracking-tight text-foreground">
                {currentAssignment
                  ? 'Assigned rides needing action'
                  : 'Waiting for assigned work'}
              </h1>
              <p className="text-sm leading-relaxed text-muted-foreground">
                This page only shows rides already assigned to your account.
                Terminal dispatch updates the list automatically as work is
                matched to you.
              </p>
            </div>
            <span className="inline-flex rounded-full bg-background/70 px-3 py-1 text-xs font-medium text-foreground">
              {rides.length} assigned
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1 rounded-full border border-border/55 bg-background/70 px-3 py-1">
              <Clock3 className="h-3.5 w-3.5" />
              {formatUpdatedAt(lastUpdatedAt)}
            </span>
            {isRefreshing ? (
              <span className="inline-flex items-center gap-1 rounded-full border border-border/55 bg-background/70 px-3 py-1">
                <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                Refreshing assignments
              </span>
            ) : null}
            {updateNotice ? (
              <span
                className="inline-flex items-center gap-1 rounded-full border border-primary/25 bg-primary/10 px-3 py-1 text-primary"
                aria-live="polite"
              >
                <AlertCircle className="h-3.5 w-3.5" />
                {updateNotice}
              </span>
            ) : null}
          </div>

          <div className="grid gap-2 sm:grid-cols-2">
            <Link
              href={currentAssignment ? '/driver/active-trip' : '/driver/dashboard'}
            >
              <Button className="h-11 w-full rounded-full">
                {currentAssignment ? 'Open Active' : 'Open Home'}
              </Button>
            </Link>
            <Link href="/driver/toda">
              <Button variant="outline" className="h-11 w-full rounded-full">
                <ListOrdered className="mr-2 h-4 w-4" />
                Open TODA
              </Button>
            </Link>
          </div>
        </section>

        {error ? (
          <InlineErrorState
            message={error}
            onRetry={() => void loadAssignedRides('manual')}
          />
        ) : null}

        {!currentAssignment ? (
          <section className="rounded-[1.85rem] border border-border/60 bg-background/58 px-4 py-5">
            <div className="flex items-start gap-3">
              <div className="rounded-full border border-border/60 bg-muted/45 p-2 text-muted-foreground">
                <AlertCircle className="h-4 w-4" />
              </div>
              <div className="space-y-1">
                <h2 className="text-sm font-semibold tracking-tight text-foreground">
                  No assigned rides right now
                </h2>
                <p className="text-sm leading-relaxed text-muted-foreground">
                  Keep duty on and stay ready. When terminal dispatch assigns a
                  new ride to your account, it will appear here automatically.
                </p>
              </div>
            </div>
          </section>
        ) : (
          <section className="space-y-3">
            <div className="space-y-1 px-1">
              <h2 className="text-sm font-semibold tracking-tight text-foreground">
                Current assignment
              </h2>
              <p className="text-xs text-muted-foreground">
                {getSectionDescription(currentAssignment.status)}
              </p>
            </div>

            <div className="overflow-hidden rounded-[1.85rem] border border-border/60 bg-background/58">
              <AssignedRideRow ride={currentAssignment} emphasis="primary" />
            </div>
          </section>
        )}

        {moreAssigned.length > 0 ? (
          <section className="space-y-3">
            <div className="space-y-1 px-1">
              <h2 className="text-sm font-semibold tracking-tight text-foreground">
                Also assigned
              </h2>
              <p className="text-xs text-muted-foreground">
                These rides are already tied to your account. Open Active first,
                then return here if more assigned work remains.
              </p>
            </div>

            <div className="overflow-hidden rounded-[1.85rem] border border-border/60 bg-background/58">
              {moreAssigned.map((ride, index) => (
                <div
                  key={ride.id}
                  className={cn(
                    index > 0 ? 'border-t border-border/55' : '',
                  )}
                >
                  <AssignedRideRow ride={ride} />
                </div>
              ))}
            </div>
          </section>
        ) : null}

        <section className="rounded-[1.75rem] border border-border/60 bg-background/58 px-4 py-4">
          <div className="flex items-start gap-3">
            <div className="rounded-full border border-primary/20 bg-primary/10 p-2 text-primary">
              <MapPin className="h-4 w-4" />
            </div>
            <div className="space-y-1">
              <p className="text-sm font-medium text-foreground">
                How assigned work behaves
              </p>
              <p className="text-xs leading-relaxed text-muted-foreground">
                Rides appear here only after dispatch assigns them to you. There
                is no accept, reject, or skip flow on this screen because the
                live system routes work directly to the assigned driver.
              </p>
            </div>
          </div>
        </section>
      </div>
    </DriverAppShell>
  );
}
