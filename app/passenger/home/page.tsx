"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  Bell,
  Bike,
  CalendarDays,
  ChevronDown,
  ChevronRight,
  CircleDot,
  Clock3,
  GraduationCap,
  MapPin,
  ShoppingBag,
  Star,
  UsersRound,
  Zap,
} from "lucide-react";
import type { TODATerminal } from "@prisma/client";
import { RideFeedbackModal } from "@/components/ride/ride-feedback-modal";
import { useStore } from "@/lib/store-context";
import { PassengerAppShell } from "@/components/passenger/passenger-app-shell";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  getPassengerHomeData,
  type PassengerHomeData,
} from "@/lib/dashboard/client";
import { getTodaTerminals, submitRideFeedback } from "@/lib/booking/client";
import { useBookingRealtime } from "@/hooks/use-booking-realtime";
import { useUserLocation } from "@/hooks/use-user-location";
import { InlineErrorState, PageLoadingState } from "@/components/page-state";
import { StatusBadge } from "@/components/status-badge";
import {
  clearRideFeedbackPrompt,
  readRideFeedbackPrompt,
  type RideFeedbackPrompt,
} from "@/lib/ride-feedback-prompt";

const RIDE_OPTIONS = [
  {
    title: "Regular",
    subtitle: "Quick ride",
    imageSrc: "/mobile-landing-hero-tricycle.png",
    cardClassName: "border-primary/20 bg-primary/[0.035]",
    imageClassName: "scale-[1.08]",
  },
  {
    title: "Shared",
    subtitle: "Lower fare",
    imageSrc: "/mobile-landing-hero-tricycle.png",
    cardClassName: "border-accent/35 bg-accent/[0.07]",
    imageClassName: "scale-[1.03]",
  },
  {
    title: "Special",
    subtitle: "Whole unit",
    imageSrc: "/mobile-landing-hero-tricycle.png",
    cardClassName: "border-accent/45 bg-accent/[0.12]",
    imageClassName: "scale-[1.03]",
  },
] as const;

const RECENT_PLACES = [
  {
    name: "SM Center Tuguegarao",
    address: "Diversion Road, Tuguegarao City",
    icon: ShoppingBag,
  },
  {
    name: "St. Paul University Philippines",
    address: "Caritan, Tuguegarao City",
    icon: GraduationCap,
  },
] as const;

function haversineKm(
  from: { latitude: number; longitude: number },
  to: { latitude: number; longitude: number },
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

function getFirstName(value: string | null | undefined) {
  return value?.trim().split(/\s+/)[0] || "Rita";
}

function getInitials(value: string | null | undefined) {
  const parts = value?.trim().split(/\s+/).filter(Boolean).slice(0, 2) ?? [];
  return parts.map((part) => part[0]?.toUpperCase() ?? "").join("") || "R";
}

function formatEta(distanceKm: number | null) {
  if (distanceKm === null) {
    return "4 min";
  }

  return `${Math.max(4, Math.round(distanceKm * 6))} min`;
}

export default function PassengerHomePage() {
  const { currentUser } = useStore();
  const [homeData, setHomeData] = useState<PassengerHomeData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [nearestTerminal, setNearestTerminal] = useState<TODATerminal | null>(
    null,
  );
  const [nearestTerminalDistance, setNearestTerminalDistance] = useState<
    number | null
  >(null);
  const [terminalContextError, setTerminalContextError] = useState<
    string | null
  >(null);
  const [feedbackPrompt, setFeedbackPrompt] =
    useState<RideFeedbackPrompt | null>(null);
  const [isFeedbackModalOpen, setIsFeedbackModalOpen] = useState(false);

  const loadingRef = useRef(false);
  const terminalLoadingRef = useRef(false);
  const feedbackPromptLoadedRef = useRef(false);

  const userLocation = useUserLocation({
    enabled: currentUser?.role === "passenger",
  });
  const canLoad = currentUser?.role === "passenger";

  const loadHomeData = useCallback(async () => {
    if (!canLoad || loadingRef.current) return;

    loadingRef.current = true;

    try {
      const response = await getPassengerHomeData();
      setHomeData(response);
      setError(null);
    } catch (err) {
      console.error("Failed to load passenger home:", err);
      setError("We could not load some home details right now.");
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
      console.error("Failed to load passenger terminal context:", err);
      setNearestTerminal(null);
      setNearestTerminalDistance(null);
      setTerminalContextError("Terminal details are temporarily unavailable.");
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

    if (prompt?.role !== "passenger") {
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
      if (
        payload.type === "ride.updated" ||
        payload.type === "terminal.updated"
      ) {
        void loadHomeData();

        if (payload.type === "terminal.updated") {
          void loadNearestTerminal();
        }
      }
    },
  });

  if (!currentUser || currentUser.role !== "passenger" || loading) {
    return <PageLoadingState tone="passenger" />;
  }

  const activeRide = homeData?.activeRide ?? null;
  const activeReservation = homeData?.activeReservations?.[0] ?? null;
  const profileName = homeData?.profile?.name ?? currentUser.name;
  const firstName = getFirstName(profileName);

  const terminalName =
    nearestTerminal?.name ??
    activeReservation?.TODATerminal.name ??
    "Centro 8 TODA";

  const queueNumber =
    activeReservation?.queuePosition ?? nearestTerminal?.currentQueued ?? 12;

  const tricyclesAvailable = nearestTerminal
    ? Math.max(nearestTerminal.capacity - nearestTerminal.currentQueued, 0)
    : 8;

  const eta = formatEta(nearestTerminalDistance);

  return (
    <PassengerAppShell
      title="Home"
      topContext="Home"
      showHeader={false}
      contentClassName="!space-y-3 !px-3.5 !pb-24 !pt-0 sm:!px-4"
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

      <section className="relative isolate -mx-3.5 overflow-hidden px-3.5 pb-4 pt-4 sm:-mx-4 sm:px-4">
        <div className="pointer-events-none absolute right-[-1.8rem] top-[5.8rem] z-0 h-[10.75rem] w-[62%] max-w-[18.5rem] sm:right-[-1rem] sm:h-[12rem] sm:w-[58%]">
          <Image
            src="/mobile-hero-img.png"
            alt=""
            fill
            priority
            sizes="(max-width: 640px) 62vw, 300px"
            className="object-contain object-right-center"
          />
        </div>

        <div className="relative z-20 flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2.5">
            <div className="relative h-11 w-11 shrink-0 overflow-hidden rounded-full bg-white shadow-sm ring-1 ring-black/5">
              <Image
                src="/trissea-logo.png"
                alt="TRISSEA"
                fill
                sizes="44px"
                className="object-contain p-1"
              />
            </div>

            <div className="min-w-0">
              <p className="truncate text-[9px] font-extrabold uppercase tracking-[0.08em] text-primary">
                Tuguegarao City
              </p>
              <p className="truncate text-[1.65rem] font-black uppercase leading-none tracking-tight text-primary [text-shadow:1.2px_1.2px_0_var(--accent)]">
                TRISSEA
              </p>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <Link
              href="/passenger/activity"
              className="relative flex h-10 w-10 items-center justify-center rounded-full border border-black/10 bg-white text-foreground shadow-sm transition-colors hover:bg-muted/45 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              aria-label="Open trips and alerts"
            >
              <Bell className="h-4 w-4" />
              <span className="absolute right-0 top-0 flex h-5 min-w-5 -translate-y-1/4 translate-x-1/4 items-center justify-center rounded-full bg-accent px-1 text-[10px] font-bold text-accent-foreground shadow-sm">
                3
              </span>
            </Link>

            <Link href="/passenger/account" aria-label="Open profile">
              <Avatar className="h-10 w-10 border border-black/10 bg-white shadow-sm">
                <AvatarFallback className="bg-primary/10 text-xs font-semibold text-primary">
                  {getInitials(profileName)}
                </AvatarFallback>
              </Avatar>
            </Link>
          </div>
        </div>

        <div className="relative z-20 mt-6 min-h-[11.25rem]">
          <div className="max-w-[55%] pt-2">
            <h1 className="text-[clamp(2.05rem,8.7vw,2.65rem)] font-semibold leading-[0.98] tracking-tight text-foreground">
              Hello, {firstName}
            </h1>

            <p className="mt-2.5 text-[0.9rem] font-medium leading-snug text-muted-foreground">
              Book your next tricycle ride
            </p>

            <div className="mt-6 flex items-center gap-2.5">
              <Link href="/passenger/on-demand">
                <Button className="h-10 rounded-[0.95rem] bg-primary px-3.5 text-xs font-semibold text-primary-foreground shadow-[0_8px_18px_-12px_rgba(20,98,46,0.7)]">
                  <Zap className="mr-1.5 h-3.5 w-3.5 fill-accent text-accent" />
                  Ride Now
                </Button>
              </Link>

              <Link href="/passenger/toda">
                <Button
                  variant="outline"
                  className="h-10 rounded-[0.95rem] border border-primary/45 bg-white px-3.5 text-xs font-semibold text-primary shadow-sm"
                >
                  <CalendarDays className="mr-1.5 h-3.5 w-3.5" />
                  Reserve
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {error ? (
        <InlineErrorState
          message="We could not load some home details right now. Please try again."
          onRetry={() => void loadHomeData()}
        />
      ) : null}

      {activeRide || activeReservation ? (
        <Link
          href={activeRide ? "/passenger/on-demand" : "/passenger/toda"}
          className="flex items-center justify-between gap-3 rounded-[1.1rem] border border-primary/15 bg-card px-3 py-2.5 text-xs shadow-sm transition-colors hover:bg-muted/35"
        >
          <div className="min-w-0">
            <p className="font-semibold">
              {activeRide ? "Active ride" : "Active reservation"}
            </p>
            <p className="truncate text-[11px] text-muted-foreground">
              {activeRide
                ? `${activeRide.pickupLocation} to ${activeRide.dropoffLocation}`
                : activeReservation?.TODATerminal.name}
            </p>
          </div>

          <div className="flex shrink-0 items-center gap-1.5">
            <StatusBadge
              status={
                activeRide?.status ?? activeReservation?.status ?? "confirmed"
              }
            />
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          </div>
        </Link>
      ) : null}

      <section className="relative z-20 space-y-3 rounded-[1.35rem] border border-primary/15 bg-card px-3 py-3 text-card-foreground shadow-[0_14px_34px_-30px_rgba(20,98,46,0.34)]">
        <div className="relative grid gap-3">
          <div className="absolute left-4 top-10 h-[3.9rem] border-l-4 border-dotted border-primary/55" />

          <div className="relative grid grid-cols-[auto_minmax(0,1fr)] gap-2.5">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
              <CircleDot className="h-7 w-7 fill-primary/10 stroke-[2.5]" />
            </span>

            <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_minmax(7.7rem,auto)] items-center gap-2">
              <div className="min-w-0">
                <p className="text-xs font-medium text-muted-foreground">
                  Pickup
                </p>
                <p className="truncate text-[15px] font-semibold leading-tight">
                  Current Location
                </p>
              </div>

              <Link
                href="/passenger/toda"
                className="min-w-0 rounded-[0.95rem] bg-primary/5 px-2.5 py-2 transition-colors hover:bg-primary/10"
              >
                <span className="flex min-w-0 items-center gap-1.5">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[10px] font-medium text-muted-foreground">
                      Assigned Terminal
                    </span>
                    <span className="block truncate text-xs font-semibold">
                      {terminalName}
                    </span>
                  </span>
                  <ChevronDown className="h-3.5 w-3.5 shrink-0 text-primary" />
                </span>
              </Link>
            </div>
          </div>

          <Link
            href="/passenger/on-demand"
            className="relative grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2.5 border-t border-border/70 pt-3 transition-colors hover:text-primary"
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent text-accent-foreground">
              <MapPin className="h-6 w-6 fill-background stroke-background" />
            </span>

            <span className="min-w-0">
              <span className="block text-xs font-medium text-muted-foreground">
                Drop-off
              </span>
              <span className="block truncate text-[15px] font-medium text-muted-foreground">
                Where are you going?
              </span>
            </span>

            <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground" />
          </Link>
        </div>

        <div className="overflow-hidden rounded-[1rem] border border-primary/15 bg-background/90">
          <div className="grid grid-cols-3 divide-x divide-primary/15">
            <div className="flex items-center gap-2 px-2 py-2.5">
              <span className="hidden h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground min-[390px]:flex">
                <UsersRound className="h-4 w-4" />
              </span>

              <div className="min-w-0">
                <p className="truncate text-[9px] font-medium text-muted-foreground">
                  Queue
                </p>
                <p className="text-xl font-semibold leading-none">
                  {queueNumber}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 px-2 py-2.5">
              <span className="relative hidden h-8 w-10 shrink-0 min-[390px]:block">
                <Image
                  src="/mobile-landing-hero-tricycle.png"
                  alt=""
                  fill
                  sizes="40px"
                  className="object-contain"
                />
              </span>

              <div className="min-w-0">
                <p className="truncate text-[9px] font-medium text-muted-foreground">
                  Available
                </p>
                <p className="text-xl font-semibold leading-none">
                  {tricyclesAvailable}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 px-2 py-2.5">
              <span className="hidden h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 border-primary text-primary min-[390px]:flex">
                <Clock3 className="h-4 w-4" />
              </span>

              <div className="min-w-0">
                <p className="truncate text-[9px] font-medium text-muted-foreground">
                  ETA
                </p>
                <p className="text-lg font-semibold leading-none">{eta}</p>
              </div>
            </div>
          </div>

          <Link href="/passenger/on-demand" className="block p-1.5 pt-0">
            <Button className="h-12 w-full rounded-[0.9rem] bg-primary text-base font-semibold text-primary-foreground shadow-[0_3px_0_var(--accent)]">
              <Bike className="mr-2 h-4 w-4" />
              Book Tricycle
              <ChevronRight className="ml-auto h-5 w-5" />
            </Button>
          </Link>
        </div>

        {terminalContextError ? (
          <p className="rounded-lg bg-muted/60 px-2.5 py-2 text-[11px] text-muted-foreground">
            Terminal info is updating. You may still book a ride.
          </p>
        ) : null}
      </section>

      <section className="space-y-2.5">
        <div className="flex items-center justify-between px-0.5">
          <h2 className="text-lg font-semibold tracking-tight">
            Ride Options
          </h2>
        </div>

        <div className="grid grid-cols-3 gap-2.5">
          {RIDE_OPTIONS.map((option) => (
            <Link
              key={option.title}
              href="/passenger/on-demand"
              className={`min-w-0 rounded-[1rem] border p-2 text-center shadow-sm transition-colors hover:bg-muted/35 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${option.cardClassName}`}
            >
              <span className="relative mx-auto block h-12 w-full overflow-hidden rounded-[0.75rem]">
                <Image
                  src={option.imageSrc}
                  alt={option.title}
                  fill
                  sizes="33vw"
                  className={`object-contain drop-shadow-[0_8px_10px_rgba(15,31,22,0.14)] ${option.imageClassName}`}
                />
              </span>

              <span className="mt-1.5 block truncate text-xs font-semibold leading-tight">
                {option.title}
              </span>
              <span className="mt-0.5 block truncate text-[10px] text-muted-foreground">
                {option.subtitle}
              </span>
            </Link>
          ))}
        </div>
      </section>

      <section className="space-y-2.5">
        <div className="flex items-center justify-between px-0.5">
          <h2 className="text-lg font-semibold tracking-tight">
            Recent Places
          </h2>
          <Link
            href="/passenger/account/settings"
            className="text-xs font-semibold text-primary"
          >
            Manage
          </Link>
        </div>

        <div className="overflow-hidden rounded-[1.15rem] border border-border/70 bg-card shadow-sm">
          {RECENT_PLACES.map((place, index) => {
            const Icon = place.icon;

            return (
              <Link
                key={place.name}
                href="/passenger/on-demand"
                className="flex w-full items-center gap-2.5 px-3 py-3 text-left transition-colors hover:bg-muted/35 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
                  <Icon className="h-4 w-4" />
                </span>

                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold leading-tight">
                    {place.name}
                  </span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {place.address}
                  </span>
                  {index === 0 ? (
                    <span className="mt-2.5 block border-b border-border/70" />
                  ) : null}
                </span>

                <Star className="h-4 w-4 shrink-0 text-muted-foreground" />
                <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
              </Link>
            );
          })}
        </div>
      </section>
    </PassengerAppShell>
  );
}