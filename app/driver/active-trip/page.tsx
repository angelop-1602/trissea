'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Clock3, ListOrdered, MapPin, Navigation, RefreshCw } from 'lucide-react';
import type { RideStatus } from '@prisma/client';
import {
  ACTIVE_BOOKING_SHEET_COLLAPSED_HEIGHT,
  ACTIVE_BOOKING_SHEET_EXPANDED_MAX_HEIGHT,
  ActiveBookingCompactLocationRow,
  ActiveBookingCompactPersonRow,
  ActiveBookingHero,
  ActiveBookingPersonCard,
  ActiveBookingRouteSummary,
  ActiveBookingSheetBody,
  ActiveBookingSheetFooter,
  ActiveBookingSheetHandle,
  ActiveBookingSheetLayout,
  ActiveBookingSheetShell,
} from '@/components/booking/active-booking-sheet';
import { DriverAppShell } from '@/components/driver/driver-app-shell';
import { MapView } from '@/components/map-view';
import { InlineErrorState } from '@/components/page-state';
import { PassengerMetricPill } from '@/components/passenger/passenger-surfaces';
import { StatusBadge } from '@/components/status-badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useBookingRealtime } from '@/hooks/use-booking-realtime';
import { useUserLocation } from '@/hooks/use-user-location';
import {
  getDriverActiveRide,
  transitionRide,
  type DriverActiveRide,
} from '@/lib/booking/client';
import type { RideTransitionAction } from '@/lib/booking/types';
import { writeRideFeedbackPrompt } from '@/lib/ride-feedback-prompt';
import { useStore } from '@/lib/store-context';
import { cn } from '@/lib/utils';

const ACTIVE_TRIP_SHELL_PROPS = {
  headerVariant: 'compact' as const,
  headerSurface: 'minimal' as const,
  preserveBottomNavSpace: false,
  showHeader: false,
  contentClassName: '!max-w-full !space-y-0 !px-0 !py-0',
};

const LIVE_STEPS = [
  { key: 'matched', label: 'Matched' },
  { key: 'en_route', label: 'Heading' },
  { key: 'arrived', label: 'Pickup' },
  { key: 'in_trip', label: 'Trip' },
] as const;

function formatCurrency(value: number) {
  return new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: 'PHP',
    maximumFractionDigits: 0,
  }).format(value);
}

function formatUpdatedAt(value: Date | null) {
  if (!value) return 'Waiting for updates';

  return new Intl.DateTimeFormat('en-PH', {
    hour: 'numeric',
    minute: '2-digit',
  }).format(value);
}

function getNextStepText(status: RideStatus) {
  switch (status) {
    case 'matched':
      return 'Head to pickup';
    case 'en_route':
      return 'Mark arrival when you reach pickup';
    case 'arrived':
      return 'Start the trip when the passenger boards';
    case 'in_trip':
      return 'Complete when you reach the destination';
    default:
      return 'Follow the active trip flow';
  }
}

function getDriverHeroTitle(status: RideStatus) {
  switch (status) {
    case 'matched':
      return 'Head to pickup';
    case 'en_route':
      return 'Mark arrival';
    case 'arrived':
      return 'Start the trip';
    case 'in_trip':
      return 'Complete the trip';
    default:
      return 'Active trip';
  }
}

function getPrimaryAction(status: RideStatus) {
  switch (status) {
    case 'matched':
      return { action: 'start_heading' as const, label: 'Start heading' };
    case 'en_route':
      return { action: 'arrive_pickup' as const, label: 'Arrived at pickup' };
    case 'arrived':
      return { action: 'start_trip' as const, label: 'Start trip' };
    case 'in_trip':
      return { action: 'complete_trip' as const, label: 'Complete trip' };
    default:
      return null;
  }
}

function getSecondaryAction(status: RideStatus) {
  switch (status) {
    case 'matched':
    case 'en_route':
    case 'arrived':
      return { action: 'driver_cancel' as const, label: 'Cancel trip' };
    default:
      return null;
  }
}

function getInitials(value: string | null | undefined, fallback: string) {
  const parts = value?.trim().split(/\s+/).filter(Boolean).slice(0, 2) ?? [];
  const initials = parts.map((part) => part[0]?.toUpperCase() ?? '').join('');

  return initials || fallback;
}

function getPassengerProfileHint(status: RideStatus) {
  switch (status) {
    case 'matched':
      return 'Passenger is waiting for you to start heading.';
    case 'en_route':
      return 'Passenger is expecting you at the pickup point.';
    case 'arrived':
      return 'Confirm pickup once the passenger boards.';
    case 'in_trip':
      return 'Passenger is currently on this trip.';
    default:
      return 'Passenger details for this active booking.';
  }
}

function ActivePassengerProfile({ ride }: { ride: DriverActiveRide }) {
  return (
    <ActiveBookingPersonCard
      label="Passenger"
      name={ride.passenger.name}
      initials={getInitials(ride.passenger.name, 'P')}
      description={getPassengerProfileHint(ride.status)}
    />
  );
}

function ActivePassengerCompactProfile({ ride }: { ride: DriverActiveRide }) {
  return (
    <ActiveBookingCompactPersonRow
      label="Passenger"
      name={ride.passenger.name}
      initials={getInitials(ride.passenger.name, 'P')}
      trailing={<StatusBadge status={ride.status} />}
    />
  );
}

function ActiveTripLoadingState() {
  return (
    <DriverAppShell title="Active" subtitle="Loading trip" topContext="Active" {...ACTIVE_TRIP_SHELL_PROPS}>
      <div className="relative h-dvh min-h-[34rem] overflow-hidden rounded-none bg-background">
        <div className="absolute inset-0 bg-muted/25" />
        <div className="pointer-events-none absolute inset-x-0 top-0 z-10 h-16 bg-gradient-to-b from-background/25 to-transparent" />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-36 bg-gradient-to-t from-background/85 via-background/28 to-transparent" />

        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-30 mx-auto w-full max-w-screen-sm px-3">
          <section className="pointer-events-auto mx-auto flex w-full flex-col overflow-hidden rounded-t-[2rem] border border-b-0 border-border/60 bg-background/92 shadow-[0_-30px_70px_-35px_rgba(0,0,0,0.72)] backdrop-blur-2xl">
            <div className="px-4 pt-4">
              <ActiveBookingSheetHandle />
            </div>
            <div className="space-y-4 px-4 pb-[calc(5.9rem+env(safe-area-inset-bottom))] pt-4">
              <div className="flex items-center justify-between gap-3">
                <Skeleton className="h-6 w-20 rounded-full" />
                <Skeleton className="h-10 w-10 rounded-full" />
              </div>
              <div className="space-y-3">
                <Skeleton className="h-14 rounded-[1.2rem]" />
                <Skeleton className="h-14 rounded-[1.2rem]" />
              </div>
              <div className="grid grid-cols-4 gap-2">
                {Array.from({ length: 4 }).map((_, index) => (
                  <Skeleton key={index} className="h-10 rounded-full" />
                ))}
              </div>
              <div className="grid grid-cols-3 gap-2">
                {Array.from({ length: 3 }).map((_, index) => (
                  <Skeleton key={index} className="h-16 rounded-[1.2rem]" />
                ))}
              </div>
              <Skeleton className="h-12 rounded-full" />
            </div>
          </section>
        </div>
      </div>
    </DriverAppShell>
  );
}

export default function DriverActiveTripPage() {
  const router = useRouter();
  const { currentUser } = useStore();
  const [activeRide, setActiveRide] = useState<DriverActiveRide | null>(null);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isSheetExpanded, setSheetExpanded] = useState(false);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [transitioningAction, setTransitioningAction] =
    useState<RideTransitionAction | null>(null);
  const isLoadingRideRef = useRef(false);
  const lastKnownRideRef = useRef<DriverActiveRide | null>(null);

  const isDriver = currentUser?.role === 'driver';
  const liveDriverLocation = useUserLocation({
    enabled: Boolean(isDriver),
    watch: true,
    minimumDistanceMeters: 10,
  });

  const loadActiveRide = useCallback(
    async (reason: 'initial' | 'manual' | 'realtime' = 'manual') => {
      if (!isDriver || isLoadingRideRef.current) return;

      isLoadingRideRef.current = true;
      if (reason !== 'initial') {
        setIsRefreshing(true);
      }

      try {
        const response = await getDriverActiveRide();
        setActiveRide(response.ride);
        const previousRide = lastKnownRideRef.current;
        if (!response.ride && previousRide?.status === 'in_trip') {
          writeRideFeedbackPrompt({
            rideId: previousRide.id,
            subjectLabel: 'Passenger',
            subjectName: previousRide.passenger.name,
            role: 'driver',
          });
          router.replace('/driver/dashboard');
        }
        lastKnownRideRef.current = response.ride;
        setLastUpdatedAt(new Date());
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load the active trip.');
      } finally {
        isLoadingRideRef.current = false;
        setLoading(false);
        setIsRefreshing(false);
      }
    },
    [isDriver, router],
  );

  useEffect(() => {
    if (!isDriver) return;
    void loadActiveRide('initial');
  }, [isDriver, loadActiveRide]);

  useEffect(() => {
    lastKnownRideRef.current = activeRide;
  }, [activeRide]);

  useBookingRealtime({
    enabled: Boolean(isDriver),
    onUpdate: (payload) => {
      if (payload.type === 'ride.updated') {
        void loadActiveRide('realtime');
      }
    },
  });

  const handleTransition = useCallback(
    async (action: RideTransitionAction) => {
      if (!activeRide) return;

      setTransitioningAction(action);
      setError(null);

      try {
        await transitionRide(activeRide.id, action);
        if (action === 'complete_trip') {
          writeRideFeedbackPrompt({
            rideId: activeRide.id,
            subjectLabel: 'Passenger',
            subjectName: activeRide.passenger.name,
            role: 'driver',
          });
          router.replace('/driver/dashboard');
          return;
        }
        await loadActiveRide('manual');
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to update trip status.');
      } finally {
        setTransitioningAction(null);
      }
    },
    [activeRide, loadActiveRide, router],
  );

  const driverLocation = useMemo(() => {
    if (liveDriverLocation) {
      return liveDriverLocation;
    }

    if (
      !activeRide ||
      typeof activeRide.driverLatitude !== 'number' ||
      typeof activeRide.driverLongitude !== 'number'
    ) {
      return undefined;
    }

    return {
      latitude: activeRide.driverLatitude,
      longitude: activeRide.driverLongitude,
    };
  }, [activeRide, liveDriverLocation]);

  const routeWaypoints = useMemo(() => {
    if (!activeRide) return [];

    const points: Array<{ latitude: number; longitude: number }> = [];

    if (driverLocation) {
      points.push(driverLocation);
    }

    if (activeRide.status !== 'in_trip') {
      points.push({
        latitude: activeRide.pickupLatitude,
        longitude: activeRide.pickupLongitude,
      });
    }

    points.push({
      latitude: activeRide.dropoffLatitude,
      longitude: activeRide.dropoffLongitude,
    });

    return points;
  }, [activeRide, driverLocation]);

  const primaryAction = activeRide ? getPrimaryAction(activeRide.status) : null;
  const secondaryAction = activeRide ? getSecondaryAction(activeRide.status) : null;
  const activeStepIndex = activeRide
    ? LIVE_STEPS.findIndex((step) => step.key === activeRide.status)
    : -1;

  if (!currentUser || currentUser.role !== 'driver' || loading) {
    return <ActiveTripLoadingState />;
  }

  return (
    <DriverAppShell
      title="Active"
      subtitle="Pickup to dropoff"
      topContext="Active"
      {...ACTIVE_TRIP_SHELL_PROPS}
    >
      <div className="relative h-dvh min-h-[34rem] overflow-hidden rounded-none bg-background">
        <MapView
          pickupLocation={activeRide?.pickupLocation}
          dropoffLocation={activeRide?.dropoffLocation}
          driverLocation={driverLocation}
          driverLocationLabel="Driver live location"
          routeWaypoints={routeWaypoints}
          pickupLat={activeRide?.pickupLatitude}
          pickupLon={activeRide?.pickupLongitude}
          dropoffLat={activeRide?.dropoffLatitude}
          dropoffLon={activeRide?.dropoffLongitude}
          height="h-full"
          className="rounded-none border-0"
          autoFitMode="initial"
          controlsPosition="top-right"
        />

        <div className="pointer-events-none absolute inset-x-0 top-0 z-10 h-16 bg-gradient-to-b from-background/25 to-transparent" />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-36 bg-gradient-to-t from-background/85 via-background/28 to-transparent" />

        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-30 mx-auto w-full max-w-screen-sm px-3">
          <ActiveBookingSheetShell
            ariaLabel={activeRide ? 'Active trip details' : 'No active trip'}
            height={
              activeRide
                ? isSheetExpanded
                  ? undefined
                  : ACTIVE_BOOKING_SHEET_COLLAPSED_HEIGHT
                : 'auto'
            }
            maxHeight={activeRide && isSheetExpanded ? ACTIVE_BOOKING_SHEET_EXPANDED_MAX_HEIGHT : undefined}
          >
            <ActiveBookingSheetHandle
              expanded={isSheetExpanded}
              onClick={activeRide ? () => setSheetExpanded((current) => !current) : undefined}
              expandedLabel="Collapse active trip sheet"
              collapsedLabel="Expand active trip sheet"
            />

            {!activeRide ? (
              <ActiveBookingSheetLayout active={false}>
                <div className="flex-1 px-4 pb-4 pt-2">
                  <div className="rounded-[1.5rem] border border-border/50 bg-background/75 px-4 py-4">
                    <p className="text-sm font-medium text-foreground">No active trip</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Open Assigned when a matched ride reaches your account.
                    </p>
                  </div>

                  {error ? (
                    <InlineErrorState
                      message={error}
                      onRetry={() => void loadActiveRide('manual')}
                      className="mt-3"
                    />
                  ) : null}
                </div>

                <ActiveBookingSheetFooter>
                  <div className="grid gap-2 sm:grid-cols-2">
                    <Link href="/driver/assigned">
                      <Button className="h-12 w-full rounded-full">Open Assigned</Button>
                    </Link>
                    <Link href="/driver/toda">
                      <Button variant="outline" className="h-12 w-full rounded-full">
                        <ListOrdered className="mr-2 h-4 w-4" />
                        Open TODA
                      </Button>
                    </Link>
                  </div>
                </ActiveBookingSheetFooter>
              </ActiveBookingSheetLayout>
            ) : isSheetExpanded ? (
              <ActiveBookingSheetLayout active>
                <ActiveBookingSheetBody active>
                  <div className="mt-4 space-y-5">
                    <ActiveBookingHero
                      eyebrow="Active trip"
                      title={getDriverHeroTitle(activeRide.status)}
                      subtitle={getPassengerProfileHint(activeRide.status)}
                      trailing={
                        <div className="flex items-center gap-2">
                          <StatusBadge status={activeRide.status} />
                          <button
                            type="button"
                            onClick={() => void loadActiveRide('manual')}
                            disabled={isRefreshing}
                            className="flex h-10 w-10 items-center justify-center rounded-full border border-border/55 bg-background/78 text-muted-foreground transition hover:border-primary/35 hover:text-primary disabled:cursor-not-allowed disabled:opacity-65"
                            aria-label="Refresh active trip"
                          >
                            <RefreshCw className={cn('h-4 w-4', isRefreshing ? 'animate-spin' : '')} />
                          </button>
                        </div>
                      }
                    />

                    <ActivePassengerProfile ride={activeRide} />

                    <div className="space-y-4 border-t border-border/45 pt-4">
                      <ActiveBookingRouteSummary
                        icon={<MapPin className="h-4 w-4" />}
                        toneClassName="bg-primary/10 text-primary"
                        pickup={activeRide.pickupLocation}
                        dropoff={activeRide.dropoffLocation}
                        via={activeRide.terminal ? `${activeRide.terminal.name} - ${activeRide.terminal.location}` : null}
                      />

                      <div className="grid grid-cols-3 gap-2 text-xs">
                        <PassengerMetricPill label="Distance" value={`${activeRide.distance} km`} />
                        <PassengerMetricPill
                          label="ETA"
                          value={
                            <span className="inline-flex items-center gap-1">
                              <Clock3 className="h-3.5 w-3.5 text-primary" />
                              {activeRide.estimatedDuration} min
                            </span>
                          }
                        />
                        <PassengerMetricPill label="Fare" value={formatCurrency(activeRide.fare)} />
                      </div>
                    </div>

                    <div className="space-y-3 border-t border-border/45 pt-4">
                      <div className="grid grid-cols-4 gap-2">
                        {LIVE_STEPS.map((step, index) => (
                          <div
                            key={step.key}
                            className={cn(
                              'rounded-full border px-2 py-2 text-center text-[11px] font-medium transition',
                              activeStepIndex >= index
                                ? 'border-primary/25 bg-primary/10 text-primary'
                                : 'border-border/45 bg-background/55 text-muted-foreground'
                            )}
                          >
                            {step.label}
                          </div>
                        ))}
                      </div>

                      <div className="space-y-1">
                        <p className="text-sm font-medium text-foreground">{getNextStepText(activeRide.status)}</p>
                        <p className="text-xs text-muted-foreground">
                          {isRefreshing ? 'Syncing...' : `Updated ${formatUpdatedAt(lastUpdatedAt)}`}
                        </p>
                      </div>
                    </div>

                    {error ? (
                      <InlineErrorState
                        message={error}
                        onRetry={() => void loadActiveRide('manual')}
                      />
                    ) : null}
                  </div>
                </ActiveBookingSheetBody>

                <ActiveBookingSheetFooter>
                  <div
                    className={cn(
                      'grid gap-2',
                      secondaryAction ? 'grid-cols-2' : 'grid-cols-1',
                    )}
                  >
                    {secondaryAction ? (
                      <Button
                        variant="outline"
                        className="h-12 rounded-full"
                        disabled={transitioningAction !== null}
                        onClick={() => void handleTransition(secondaryAction.action)}
                      >
                        {transitioningAction === secondaryAction.action
                          ? 'Updating...'
                          : secondaryAction.label}
                      </Button>
                    ) : null}

                    {primaryAction ? (
                      <Button
                        className="h-12 rounded-full"
                        disabled={transitioningAction !== null}
                        onClick={() => void handleTransition(primaryAction.action)}
                      >
                        {transitioningAction === primaryAction.action
                          ? 'Updating...'
                          : primaryAction.label}
                      </Button>
                    ) : (
                      <Button className="h-12 rounded-full" disabled>
                        No action available
                      </Button>
                    )}
                  </div>
                </ActiveBookingSheetFooter>
              </ActiveBookingSheetLayout>
            ) : (
              <ActiveBookingSheetLayout active={false}>
                <ActiveBookingSheetBody active={false} className="pb-3 pt-1">
                  <button
                    type="button"
                    onClick={() => setSheetExpanded(true)}
                    className="w-full text-left transition"
                    aria-label="Expand active trip sheet"
                  >
                    <ActivePassengerCompactProfile ride={activeRide} />
                    <ActiveBookingCompactLocationRow
                      icon={<MapPin className="h-4 w-4" />}
                      toneClassName="bg-primary/10 text-primary"
                      label="Pickup"
                      value={activeRide.pickupLocation}
                    />
                    <ActiveBookingCompactLocationRow
                      icon={<Navigation className="h-4 w-4" />}
                      toneClassName="bg-secondary/10 text-secondary"
                      label="Destination"
                      value={activeRide.dropoffLocation}
                      withBorder={false}
                    />
                  </button>
                </ActiveBookingSheetBody>

                <ActiveBookingSheetFooter>
                  {error ? (
                    <InlineErrorState
                      message={error}
                      onRetry={() => void loadActiveRide('manual')}
                      className="mb-3"
                    />
                  ) : null}

                  {primaryAction ? (
                    <Button
                      className="h-12 w-full rounded-full"
                      disabled={transitioningAction !== null}
                      onClick={() => void handleTransition(primaryAction.action)}
                    >
                      {transitioningAction === primaryAction.action
                        ? 'Updating...'
                        : primaryAction.label}
                    </Button>
                  ) : (
                    <Button className="h-12 w-full rounded-full" disabled>
                      No action available
                    </Button>
                  )}
                </ActiveBookingSheetFooter>
              </ActiveBookingSheetLayout>
            )}
          </ActiveBookingSheetShell>
        </div>
      </div>
    </DriverAppShell>
  );
}
