'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, CalendarClock, Clock3, Compass, MapPinned, Navigation, Route } from 'lucide-react';
import type { TODATerminal } from '@prisma/client';
import { RideFeedbackModal } from '@/components/ride/ride-feedback-modal';
import { useStore } from '@/lib/store-context';
import { PassengerAppShell } from '@/components/passenger/passenger-app-shell';
import { Button } from '@/components/ui/button';
import { getPassengerHomeData, type PassengerHomeData } from '@/lib/dashboard/client';
import { getTodaTerminals, submitRideFeedback } from '@/lib/booking/client';
import { useBookingRealtime } from '@/hooks/use-booking-realtime';
import { useUserLocation } from '@/hooks/use-user-location';
import { InlineErrorState, PageLoadingState } from '@/components/page-state';
import { StatusBadge } from '@/components/status-badge';
import { PassengerMetricPill } from '@/components/passenger/passenger-surfaces';
import {
  clearRideFeedbackPrompt,
  readRideFeedbackPrompt,
  type RideFeedbackPrompt,
} from '@/lib/ride-feedback-prompt';

function formatCurrency(value: number) {
  return new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: 'PHP',
    maximumFractionDigits: 0,
  }).format(value);
}

function formatDateTimeShort(value: string | Date) {
  const date = value instanceof Date ? value : new Date(value);

  return new Intl.DateTimeFormat('en-PH', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
}

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

function formatRideSubtitle(status: string) {
  switch (status) {
    case 'searching':
      return 'Your request is queued at the nearest TODA terminal.';
    case 'matched':
      return 'A driver has been matched and is preparing to head to you.';
    case 'en_route':
      return 'Your driver is on the way to your pickup.';
    case 'arrived':
      return 'Your driver has arrived at the pickup point.';
    case 'in_trip':
      return 'Your trip is currently in progress.';
    default:
      return 'Your latest ride state is available here.';
  }
}

function formatReservationSubtitle(status: string) {
  switch (status) {
    case 'arrived':
      return 'Your reservation is marked arrived at the terminal.';
    case 'confirmed':
    default:
      return 'Your reservation is active and waiting in the TODA queue.';
  }
}

function HomeSectionTitle({
  title,
  action,
}: {
  title: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-3 px-1">
      <h2 className="text-sm font-semibold tracking-tight text-foreground">{title}</h2>
      {action}
    </div>
  );
}

export default function PassengerHomePage() {
  const { currentUser } = useStore();
  const [homeData, setHomeData] = useState<PassengerHomeData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [nearestTerminal, setNearestTerminal] = useState<TODATerminal | null>(null);
  const [nearestTerminalDistance, setNearestTerminalDistance] = useState<number | null>(null);
  const [terminalContextError, setTerminalContextError] = useState<string | null>(null);
  const [feedbackPrompt, setFeedbackPrompt] = useState<RideFeedbackPrompt | null>(null);
  const [isFeedbackModalOpen, setIsFeedbackModalOpen] = useState(false);
  const loadingRef = useRef(false);
  const terminalLoadingRef = useRef(false);
  const feedbackPromptLoadedRef = useRef(false);
  const userLocation = useUserLocation({ enabled: currentUser?.role === 'passenger' });

  const canLoad = currentUser?.role === 'passenger';

  const loadHomeData = useCallback(async () => {
    if (!canLoad || loadingRef.current) return;

    loadingRef.current = true;
    try {
      const response = await getPassengerHomeData();
      setHomeData(response);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load passenger home.');
    } finally {
      loadingRef.current = false;
      setLoading(false);
    }
  }, [canLoad]);

  const loadNearestTerminal = useCallback(async () => {
    if (!canLoad || !userLocation || terminalLoadingRef.current) {
      return;
    }

    terminalLoadingRef.current = true;

    try {
      const response = await getTodaTerminals({
        latitude: userLocation.latitude,
        longitude: userLocation.longitude,
      });

      if (response.terminals.length === 0) {
        setNearestTerminal(null);
        setNearestTerminalDistance(null);
        setTerminalContextError(null);
        return;
      }

      const nearest = response.terminals
        .map((terminal) => ({
          terminal,
          distanceKm: haversineKm(userLocation, {
            latitude: terminal.latitude,
            longitude: terminal.longitude,
          }),
        }))
        .sort((a, b) => a.distanceKm - b.distanceKm)[0];

      setNearestTerminal(nearest.terminal);
      setNearestTerminalDistance(nearest.distanceKm);
      setTerminalContextError(null);
    } catch (err) {
      setNearestTerminal(null);
      setNearestTerminalDistance(null);
      setTerminalContextError(err instanceof Error ? err.message : 'Failed to load terminal context.');
    } finally {
      terminalLoadingRef.current = false;
    }
  }, [canLoad, userLocation]);

  useEffect(() => {
    void loadHomeData();
  }, [loadHomeData]);

  useEffect(() => {
    if (!canLoad || feedbackPromptLoadedRef.current) {
      return;
    }

    feedbackPromptLoadedRef.current = true;
    const prompt = readRideFeedbackPrompt();
    if (prompt?.role !== 'passenger') {
      return;
    }

    clearRideFeedbackPrompt();
    setFeedbackPrompt(prompt);
    setIsFeedbackModalOpen(true);
  }, [canLoad]);

  useEffect(() => {
    if (!userLocation) {
      setNearestTerminal(null);
      setNearestTerminalDistance(null);
      setTerminalContextError(null);
      return;
    }

    void loadNearestTerminal();
  }, [loadNearestTerminal, userLocation]);

  useBookingRealtime({
    enabled: Boolean(canLoad),
    onUpdate: (payload) => {
      if (payload.type === 'ride.updated' || payload.type === 'terminal.updated') {
        void loadHomeData();
        if (payload.type === 'terminal.updated') {
          void loadNearestTerminal();
        }
      }
    },
  });

  if (!currentUser || currentUser.role !== 'passenger' || loading) {
    return <PageLoadingState tone="passenger" />;
  }

  const activeRide = homeData?.activeRide ?? null;
  const activeReservation = homeData?.activeReservations?.[0] ?? null;
  const latestRide =
    homeData?.recentRides.find((ride) => ride.status === 'completed' || ride.status === 'cancelled') ?? null;
  const profileName = homeData?.profile?.name ?? currentUser.name;

  const heroTitle = activeRide
    ? 'Ride in progress'
    : activeReservation
      ? 'Active TODA reservation'
      : `Ready when you are, ${profileName}`;

  const heroCopy = activeRide
    ? 'Resume your live ride or review the route details below.'
    : activeReservation
      ? 'Your queue position is active. Check the TODA details or keep an eye on your boarding state.'
      : 'Book a ride, open TODA, or review your recent activity.';

  return (
    <PassengerAppShell
      title="Home"
      subtitle="Live ride, queue, and terminal updates."
      topContext="Home"
      headerVariant="compact"
      headerSurface="minimal"
    >
      <RideFeedbackModal
        open={isFeedbackModalOpen && Boolean(feedbackPrompt)}
        onOpenChange={setIsFeedbackModalOpen}
        title="How was your trip?"
        description="Rate your driver and add an optional note before you continue."
        subjectLabel="Driver"
        subjectName={feedbackPrompt?.subjectName}
        onSubmit={async (input) => {
          if (!feedbackPrompt) return;
          await submitRideFeedback(feedbackPrompt.rideId, input);
          setIsFeedbackModalOpen(false);
          setFeedbackPrompt(null);
          await loadHomeData();
        }}
      />
      <section className="space-y-4 rounded-[2rem] border border-primary/15 bg-primary/6 px-4 py-5">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Current state</p>
            <h1 className="text-2xl font-semibold tracking-tight">{heroTitle}</h1>
            <p className="text-sm text-muted-foreground">{heroCopy}</p>
          </div>
          {activeRide ? <StatusBadge status={activeRide.status} /> : null}
          {!activeRide && activeReservation ? <StatusBadge status={activeReservation.status} /> : null}
        </div>

        <div className="flex flex-wrap gap-2">
          {activeRide ? (
            <>
              <Link href="/passenger/on-demand" className="flex-1 min-w-[10rem]">
                <Button className="h-11 w-full rounded-full bg-primary">Resume Ride</Button>
              </Link>
              <Link href="/passenger/toda" className="flex-1 min-w-[10rem]">
                <Button variant="outline" className="h-11 w-full rounded-full">
                  Open TODA
                </Button>
              </Link>
            </>
          ) : activeReservation ? (
            <>
              <Link href="/passenger/toda" className="flex-1 min-w-[10rem]">
                <Button className="h-11 w-full rounded-full bg-primary">Open TODA</Button>
              </Link>
              <Link href="/passenger/on-demand" className="flex-1 min-w-[10rem]">
                <Button variant="outline" className="h-11 w-full rounded-full">
                  Book Ride
                </Button>
              </Link>
            </>
          ) : (
            <>
              <Link href="/passenger/on-demand" className="flex-1 min-w-[10rem]">
                <Button className="h-11 w-full rounded-full bg-primary">Book Ride</Button>
              </Link>
              <Link href="/passenger/toda" className="flex-1 min-w-[10rem]">
                <Button variant="outline" className="h-11 w-full rounded-full">
                  Open TODA
                </Button>
              </Link>
            </>
          )}
        </div>
      </section>

      {error ? <InlineErrorState message={error} onRetry={() => void loadHomeData()} /> : null}

      {activeRide ? (
        <section className="space-y-3">
          <HomeSectionTitle title="Active ride" action={<StatusBadge status={activeRide.status} />} />
          <div className="space-y-4 rounded-[1.85rem] border border-border/60 bg-background/58 px-4 py-4">
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-1">
                <p className="text-sm font-medium">{activeRide.pickupLocation}</p>
                <p className="text-xs text-muted-foreground">to {activeRide.dropoffLocation}</p>
              </div>
              <ArrowRight className="mt-1 h-4 w-4 text-muted-foreground" />
            </div>
            <p className="text-sm text-muted-foreground">{formatRideSubtitle(activeRide.status)}</p>
            <div className="grid grid-cols-3 gap-2 text-xs">
              <PassengerMetricPill label="Distance" value={`${activeRide.distance} km`} />
              <PassengerMetricPill label="ETA" value={`${activeRide.estimatedDuration} min`} />
              <PassengerMetricPill label="Fare" value={formatCurrency(activeRide.fare)} />
            </div>
            <Link href="/passenger/on-demand">
              <Button className="h-11 w-full rounded-full">
                Resume Ride
                <ArrowRight className="ml-1 h-4 w-4" />
              </Button>
            </Link>
          </div>
        </section>
      ) : null}

      {activeReservation ? (
        <section className="space-y-3">
          <HomeSectionTitle title="Active reservation" action={<StatusBadge status={activeReservation.status} />} />
          <div className="space-y-4 rounded-[1.85rem] border border-border/60 bg-background/58 px-4 py-4">
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-1">
                <p className="text-sm font-medium">{activeReservation.TODATerminal.name}</p>
                <p className="text-xs text-muted-foreground">{activeReservation.TODATerminal.location}</p>
              </div>
              <ArrowRight className="mt-1 h-4 w-4 text-muted-foreground" />
            </div>
            <p className="text-sm text-muted-foreground">{formatReservationSubtitle(activeReservation.status)}</p>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <PassengerMetricPill
                label="Queue"
                value={
                  <span className="inline-flex items-center gap-1">
                    <Route className="h-3.5 w-3.5 text-primary" />
                    #{activeReservation.queuePosition}
                  </span>
                }
              />
              <PassengerMetricPill
                label="Boarding"
                value={
                  <span className="inline-flex items-center gap-1">
                    <CalendarClock className="h-3.5 w-3.5 text-primary" />
                    {new Date(activeReservation.boardingTime).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                }
              />
            </div>
            <Link href="/passenger/toda">
              <Button variant="outline" className="h-11 w-full rounded-full">
                Open TODA
              </Button>
            </Link>
          </div>
        </section>
      ) : null}

      <section className="space-y-3">
        <HomeSectionTitle
          title="Nearest TODA"
          action={
            <Link href="/passenger/toda">
              <Button variant="ghost" size="sm" className="h-8 rounded-full px-3 text-xs">
                Open TODA
              </Button>
            </Link>
          }
        />
        <div className="space-y-4 rounded-[1.85rem] border border-border/60 bg-background/58 px-4 py-4">
          {nearestTerminal ? (
            <>
              <div className="space-y-1">
                <p className="text-sm font-medium">{nearestTerminal.name}</p>
                <p className="text-xs text-muted-foreground">{nearestTerminal.location}</p>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <PassengerMetricPill
                  label="Distance"
                  value={
                    <span className="inline-flex items-center gap-1">
                      <Navigation className="h-3.5 w-3.5 text-primary" />
                      {nearestTerminalDistance !== null ? `${nearestTerminalDistance.toFixed(2)} km` : 'Nearby'}
                    </span>
                  }
                />
                <PassengerMetricPill
                  label="Queue"
                  value={
                    <span className="inline-flex items-center gap-1">
                      <Clock3 className="h-3.5 w-3.5 text-primary" />
                      {nearestTerminal.currentQueued} / {nearestTerminal.capacity}
                    </span>
                  }
                />
              </div>
              <div className="flex flex-wrap gap-2">
                <Link href="/passenger/toda" className="flex-1 min-w-[10rem]">
                  <Button variant="outline" className="h-11 w-full rounded-full">
                    <Compass className="mr-2 h-4 w-4" />
                    Open TODA
                  </Button>
                </Link>
                {!activeRide ? (
                  <Link href="/passenger/on-demand" className="flex-1 min-w-[10rem]">
                    <Button className="h-11 w-full rounded-full">
                      <MapPinned className="mr-2 h-4 w-4" />
                      Book Ride
                    </Button>
                  </Link>
                ) : null}
              </div>
            </>
          ) : userLocation ? (
            <p className="text-sm text-muted-foreground">
              No TODA terminal is currently available near your location.
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">
              Enable location access to see your nearest TODA terminal.
            </p>
          )}

          {terminalContextError ? <p className="text-xs text-muted-foreground">{terminalContextError}</p> : null}
        </div>
      </section>

      {!activeRide && latestRide ? (
        <section className="space-y-3">
          <HomeSectionTitle
            title="Latest activity"
            action={
              <Link href="/passenger/activity">
                <Button variant="ghost" size="sm" className="h-8 rounded-full px-3 text-xs">
                  View all
                </Button>
              </Link>
            }
          />
          <div className="rounded-[1.85rem] border border-border/60 bg-background/58 px-4 py-4">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-sm font-medium">{latestRide.pickupLocation}</p>
                <p className="text-xs text-muted-foreground">to {latestRide.dropoffLocation}</p>
              </div>
              <StatusBadge status={latestRide.status} />
            </div>
            <p className="text-xs text-muted-foreground">
              {formatDateTimeShort(latestRide.createdAt)} | {formatCurrency(latestRide.fare)}
            </p>
            <Link href="/passenger/activity" className="mt-3 inline-flex">
              <Button variant="ghost" size="sm" className="h-8 rounded-full px-3 text-xs">
                Open Activity
                <ArrowRight className="ml-1 h-4 w-4" />
              </Button>
            </Link>
          </div>
        </section>
      ) : null}
    </PassengerAppShell>
  );
}


