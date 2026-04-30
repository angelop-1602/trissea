'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Clock3, MapPin, Navigation, Sparkles, Star, XCircle } from 'lucide-react';
import type { MapMouseEvent } from 'maplibre-gl';
import { BRAND_NAME } from '@/lib/brand';
import { useStore } from '@/lib/store-context';
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
import { PassengerAppShell } from '@/components/passenger/passenger-app-shell';
import { PassengerMetricPill } from '@/components/passenger/passenger-surfaces';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { InlineErrorState } from '@/components/page-state';
import { StatusBadge } from '@/components/status-badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Map,
  MapControls,
  MapMarker,
  MapRoute,
  MarkerContent,
  MarkerTooltip,
  type MapRef,
} from '@/components/ui/map';
import {
  cancelOnDemandRide,
  createOnDemand,
  getPassengerActiveRide,
  quoteOnDemand,
  type PassengerActiveRide,
} from '@/lib/booking/client';
import { useBookingRealtime } from '@/hooks/use-booking-realtime';
import { useUserLocation } from '@/hooks/use-user-location';
import { writeRideFeedbackPrompt } from '@/lib/ride-feedback-prompt';

const FALLBACK_MAP_CENTER: [number, number] = [121.7268, 17.6136];
const DRAFT_STORAGE_KEY = 'trissea:on-demand:draft';
const COLLAPSED_SEARCHING_RIDE_HEIGHT =
  'min(calc(100dvh - 0.75rem), calc(12.5rem + 6.85rem + env(safe-area-inset-bottom)))';
interface GeocodeSearchResult {
  label: string;
  latitude: number;
  longitude: number;
}

type RideHandoffState = 'completed' | 'cancelled' | null;

function markerLabel(point: { latitude: number; longitude: number }) {
  return `${point.latitude.toFixed(5)}, ${point.longitude.toFixed(5)}`;
}

function getBoundsFromCoordinates(coordinates: [number, number][]) {
  let minLng = coordinates[0][0];
  let maxLng = coordinates[0][0];
  let minLat = coordinates[0][1];
  let maxLat = coordinates[0][1];

  for (const [lng, lat] of coordinates) {
    if (lng < minLng) minLng = lng;
    if (lng > maxLng) maxLng = lng;
    if (lat < minLat) minLat = lat;
    if (lat > maxLat) maxLat = lat;
  }

  return [
    [minLng, minLat],
    [maxLng, maxLat],
  ] as [[number, number], [number, number]];
}

function pointsMatch(
  point: { latitude: number; longitude: number } | null,
  other: { latitude: number; longitude: number } | null,
  tolerance = 0.0005
) {
  if (!point || !other) return false;

  return (
    Math.abs(point.latitude - other.latitude) <= tolerance &&
    Math.abs(point.longitude - other.longitude) <= tolerance
  );
}

function formatPeso(value: number) {
  return new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: 'PHP',
    maximumFractionDigits: 0,
  }).format(value);
}

function getRideSubtitle(ride: { status: PassengerActiveRide['status'] }) {
  switch (ride.status) {
    case 'searching':
      return 'We are lining up the next available driver from the nearest TODA queue.';
    case 'matched':
      return 'A driver has been matched and is preparing to head to your pickup point.';
    case 'en_route':
      return 'Your driver is on the way from the assigned TODA terminal.';
    case 'arrived':
      return 'Your driver has arrived at the pickup point.';
    case 'in_trip':
      return 'Your ride is on the way to your destination.';
    default:
      return 'Ride status updated.';
  }
}

function getInitials(value: string | null | undefined, fallback: string) {
  const parts = value?.trim().split(/\s+/).filter(Boolean).slice(0, 2) ?? [];
  const initials = parts.map((part) => part[0]?.toUpperCase() ?? '').join('');

  return initials || fallback;
}

function getDriverProfileHint(status: PassengerActiveRide['status']) {
  switch (status) {
    case 'matched':
      return 'Matched and preparing for pickup.';
    case 'en_route':
      return 'Heading to your pickup point.';
    case 'arrived':
      return 'Arrived at your pickup point.';
    case 'in_trip':
      return 'Taking you to your destination.';
    default:
      return 'Driver details appear after assignment.';
  }
}

function ActiveDriverProfile({ ride }: { ride: PassengerActiveRide }) {
  if (!ride.driver) {
    return null;
  }

  return (
    <ActiveBookingPersonCard
      label="Your driver"
      name={ride.driver.name}
      initials={getInitials(ride.driver.name, 'D')}
      description={getDriverProfileHint(ride.status)}
      trailing={
        <div className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary">
          <Star className="h-3.5 w-3.5 fill-current" />
          {ride.driver.rating != null ? ride.driver.rating.toFixed(1) : 'New'}
        </div>
      }
    />
  );
}

function ActiveDriverCompactProfile({ ride }: { ride: PassengerActiveRide }) {
  if (!ride.driver) {
    return null;
  }

  return (
    <ActiveBookingCompactPersonRow
      label="Your driver"
      name={ride.driver.name}
      initials={getInitials(ride.driver.name, 'D')}
      trailing={<StatusBadge status={ride.status} />}
    />
  );
}

function getDraftCopy({
  pickup,
  dropoff,
  quote,
  isBooking,
}: {
  pickup: boolean;
  dropoff: boolean;
  quote: boolean;
  isBooking: boolean;
}) {
  if (isBooking) {
    return {
      label: 'Sending request',
      title: 'Sending your ride to TODA dispatch',
      subtitle: 'Hold on while we send this route to the nearest available terminal.',
    };
  }

  if (!pickup) {
    return {
      label: 'Start here',
      title: 'Set your pickup',
      subtitle: 'Search for your street or tap directly on the map.',
    };
  }

  if (!dropoff) {
    return {
      label: 'Destination',
      title: 'Where are you going?',
      subtitle: 'Add your destination to prepare the route estimate and fare.',
    };
  }

  if (!quote) {
    return {
      label: 'Checking route',
      title: 'Preparing your route',
      subtitle: 'We are calculating the latest fare and estimated travel time.',
    };
  }

  return {
    label: 'Ready to book',
    title: 'Your route is ready',
    subtitle: 'Review the fare and ETA, then confirm when you are ready to go.',
  };
}

function readDraftFromSessionStorage() {
  if (typeof window === 'undefined') {
    return null;
  }

  const nextDraft = window.sessionStorage.getItem(DRAFT_STORAGE_KEY);
  if (nextDraft) {
    return nextDraft;
  }

  return null;
}

function clearDraftSessionStorage() {
  if (typeof window === 'undefined') {
    return;
  }

  window.sessionStorage.removeItem(DRAFT_STORAGE_KEY);
}

function writeDraftToSessionStorage(value: string) {
  if (typeof window === 'undefined') {
    return;
  }

  window.sessionStorage.setItem(DRAFT_STORAGE_KEY, value);
}

function buildRoadRouteRequestKey(coordinates: [number, number][]) {
  return coordinates.map(([longitude, latitude]) => `${longitude},${latitude}`).join(';');
}

function SearchField({
  value,
  onChange,
  onFocus,
  placeholder,
  searching,
  suggestions,
  onSelect,
  icon,
  iconToneClassName,
  readOnly = false,
}: {
  value: string;
  onChange: (value: string) => void;
  onFocus?: () => void;
  placeholder: string;
  searching: boolean;
  suggestions: GeocodeSearchResult[];
  onSelect: (result: GeocodeSearchResult) => void;
  icon: React.ReactNode;
  iconToneClassName: string;
  readOnly?: boolean;
}) {
  return (
    <div className="space-y-2 py-2 first:pt-0 last:pb-0">
      <div className="flex items-center gap-3">
        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl ${iconToneClassName}`}>
          {icon}
        </div>
        <div className="min-w-0 flex-1">
          <Input
            value={value}
            onChange={(event) => onChange(event.target.value)}
            onFocus={onFocus}
            placeholder={placeholder}
            readOnly={readOnly}
            className="h-12 border-0 bg-transparent px-0 text-base shadow-none focus-visible:ring-0 read-only:cursor-default"
          />
        </div>
      </div>

      {searching ? <p className="pl-[3.25rem] text-xs text-muted-foreground">Searching places...</p> : null}
      {suggestions.length > 0 ? (
        <div className="ml-[3.25rem] overflow-hidden rounded-[1.2rem] bg-muted/35">
          {suggestions.map((result) => (
            <button
              key={`${result.latitude}-${result.longitude}-${result.label}`}
              type="button"
              className="block w-full border-b border-border/40 px-4 py-3 text-left text-sm transition hover:bg-muted/35 last:border-b-0"
              onClick={() => onSelect(result)}
            >
              {result.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function OnDemandLoadingSkeleton() {
  return (
    <PassengerAppShell
      title="Book"
      subtitle="Request a ride or follow the live route."
      topContext="Book"
      headerVariant="compact"
      headerSurface="minimal"
      preserveBottomNavSpace={false}
      showHeader={false}
      contentClassName="!max-w-full !space-y-0 !px-0 !py-0"
    >
      <div>
        <div className="relative min-h-dvh overflow-hidden rounded-none bg-background">
          <div className="absolute inset-0 bg-gradient-to-br from-muted/50 via-muted/20 to-background">
            <div className="absolute inset-0 opacity-50 [background-image:radial-gradient(circle_at_center,hsl(var(--border))_1px,transparent_1px)] [background-size:22px_22px]" />
          </div>
          <div className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-background/10 to-transparent" />
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-48 bg-gradient-to-t from-background/92 via-background/38 to-transparent" />

          <div className="absolute inset-x-0 bottom-0 z-20">
            <div className="mx-auto w-full max-w-screen-sm">
              <div className="mx-3 overflow-hidden rounded-t-[2rem] border border-b-0 border-border/60 bg-background/88 shadow-[0_-30px_70px_-35px_rgba(0,0,0,0.8)] backdrop-blur-2xl">
                <div className="px-4 pt-3 pb-24">
                  <ActiveBookingSheetHandle />
                  <div className="mt-4 space-y-5">
                    <div className="space-y-2">
                      <Skeleton className="h-3 w-20 rounded-full" />
                      <Skeleton className="h-8 w-56 rounded-full" />
                      <Skeleton className="h-4 w-64 rounded-full" />
                    </div>

                    <div className="overflow-hidden rounded-[1.75rem] border border-border/55 bg-background/55">
                      <div className="px-4 py-4">
                        <div className="flex items-start gap-3">
                          <Skeleton className="mt-1 h-10 w-10 shrink-0 rounded-2xl" />
                          <div className="min-w-0 flex-1 space-y-2">
                            <Skeleton className="h-3 w-14 rounded-full" />
                            <Skeleton className="h-8 w-full rounded-full" />
                          </div>
                        </div>
                      </div>

                      <div className="border-t border-border/55 px-4 py-4">
                        <div className="flex items-start gap-3">
                          <Skeleton className="mt-1 h-10 w-10 shrink-0 rounded-2xl" />
                          <div className="min-w-0 flex-1 space-y-2">
                            <Skeleton className="h-3 w-16 rounded-full" />
                            <Skeleton className="h-8 w-full rounded-full" />
                          </div>
                        </div>
                      </div>

                      <div className="border-t border-border/55 px-4 py-3">
                        <div className="flex gap-2">
                          <Skeleton className="h-10 flex-1 rounded-full" />
                          <Skeleton className="h-10 flex-1 rounded-full" />
                        </div>
                      </div>
                    </div>

                    <div className="space-y-3 rounded-[1.75rem] border border-border/55 bg-background/55 px-4 py-4">
                      <Skeleton className="h-16 rounded-[1.25rem]" />
                      <Skeleton className="h-16 rounded-[1.25rem]" />
                      <div className="grid grid-cols-3 gap-2">
                        <Skeleton className="h-16 rounded-[1.15rem]" />
                        <Skeleton className="h-16 rounded-[1.15rem]" />
                        <Skeleton className="h-16 rounded-[1.15rem]" />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="absolute inset-x-0 bottom-0 border-t border-border/55 bg-background/94 px-4 pt-3 pb-[calc(1rem+env(safe-area-inset-bottom))] backdrop-blur-xl">
                  <div className="grid grid-cols-2 gap-2">
                    <Skeleton className="h-12 rounded-full" />
                    <Skeleton className="h-12 rounded-full" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </PassengerAppShell>
  );
}

function CoordinateMarker({
  longitude,
  latitude,
  tone,
  label,
}: {
  longitude: number;
  latitude: number;
  tone: 'pickup' | 'dropoff' | 'driver' | 'current';
  label: string;
}) {
  const classes =
    tone === 'pickup'
      ? 'bg-primary'
      : tone === 'dropoff'
        ? 'bg-secondary'
        : tone === 'current'
          ? 'bg-sky-400'
          : 'bg-chart-2';

  return (
    <MapMarker longitude={longitude} latitude={latitude}>
      <MarkerContent>
        <div className="relative">
          {tone === 'driver' ? <div className="absolute inset-0 rounded-full bg-primary/40 blur-sm" /> : null}
          <div className={`h-4 w-4 rounded-full border-2 border-background shadow ${classes}`} />
        </div>
      </MarkerContent>
      <MarkerTooltip>{label}</MarkerTooltip>
    </MapMarker>
  );
}

export default function OnDemandBookingPage() {
  const router = useRouter();
  const { currentUser } = useStore();
  const [mapInstance, setMapInstance] = useState<MapRef | null>(null);
  const [pickup, setPickup] = useState<{ latitude: number; longitude: number } | null>(null);
  const [dropoff, setDropoff] = useState<{ latitude: number; longitude: number } | null>(null);
  const [pickupStreetLabel, setPickupStreetLabel] = useState<string | null>(null);
  const [dropoffStreetLabel, setDropoffStreetLabel] = useState<string | null>(null);
  const [pickupQuery, setPickupQuery] = useState('');
  const [dropoffQuery, setDropoffQuery] = useState('');
  const [pickupSuggestions, setPickupSuggestions] = useState<GeocodeSearchResult[]>([]);
  const [dropoffSuggestions, setDropoffSuggestions] = useState<GeocodeSearchResult[]>([]);
  const [isSearchingPickup, setIsSearchingPickup] = useState(false);
  const [isSearchingDropoff, setIsSearchingDropoff] = useState(false);
  const [isResolvingPickupStreet, setIsResolvingPickupStreet] = useState(false);
  const [isResolvingDropoffStreet, setIsResolvingDropoffStreet] = useState(false);
  const [activeRide, setActiveRide] = useState<PassengerActiveRide | null>(null);
  const [activeRideRouteCoordinates, setActiveRideRouteCoordinates] = useState<[number, number][]>([]);
  const [quote, setQuote] = useState<{
    totalFare: number;
    distanceKm: number;
    estimatedDurationMin: number;
    routeCoordinates: [number, number][];
  } | null>(null);
  const [loadingActiveRide, setLoadingActiveRide] = useState(true);
  const [isQuoting, setIsQuoting] = useState(false);
  const [isBooking, setIsBooking] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [sheetExpanded, setSheetExpanded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rideHandoff, setRideHandoff] = useState<RideHandoffState>(null);
  const [initialUserCenter, setInitialUserCenter] = useState<[number, number] | null>(null);
  const isLoadingRideRef = useRef(false);
  const autoQuoteTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastQuotedRouteKeyRef = useRef<string | null>(null);
  const pickupLookupKeyRef = useRef<string | null>(null);
  const dropoffLookupKeyRef = useRef<string | null>(null);
  const restoredDraftRef = useRef(false);
  const previousRideStatusRef = useRef<PassengerActiveRide['status'] | null>(null);
  const lastKnownRideRef = useRef<PassengerActiveRide | null>(null);
  const hasAutoCenteredMapRef = useRef(false);
  const canBook = currentUser?.role === 'passenger';
  const userLocation = useUserLocation({
    enabled: Boolean(canBook),
    watch: true,
    minimumDistanceMeters: 10,
  });
  const initialUserPoint = useMemo(
    () =>
      initialUserCenter
        ? { longitude: initialUserCenter[0], latitude: initialUserCenter[1] }
        : null,
    [initialUserCenter]
  );
  const activeRideDirectRouteCoordinates = useMemo<[number, number][]>(
    () =>
      activeRide
        ? [
            [activeRide.pickupLongitude, activeRide.pickupLatitude],
            [activeRide.dropoffLongitude, activeRide.dropoffLatitude],
          ]
        : [],
    [
      activeRide?.dropoffLatitude,
      activeRide?.dropoffLongitude,
      activeRide?.pickupLatitude,
      activeRide?.pickupLongitude,
    ]
  );
  const activeRideDirectRouteKey = activeRideDirectRouteCoordinates.length >= 2
    ? buildRoadRouteRequestKey(activeRideDirectRouteCoordinates)
    : '';
  const displayedActiveRideRouteCoordinates =
    activeRideRouteCoordinates.length >= 2 ? activeRideRouteCoordinates : activeRideDirectRouteCoordinates;
  const displayedActiveRideRouteKey = displayedActiveRideRouteCoordinates.length >= 2
    ? buildRoadRouteRequestKey(displayedActiveRideRouteCoordinates)
    : '';

  const resolveStreetLabel = useCallback(async (point: { latitude: number; longitude: number }) => {
    const query = new URLSearchParams({
      latitude: point.latitude.toString(),
      longitude: point.longitude.toString(),
    });
    const response = await fetch(`/api/geocode/reverse?${query.toString()}`, { cache: 'no-store' });
    if (!response.ok) throw new Error('Failed to resolve street name.');
    const payload = (await response.json()) as { label?: string };
    return payload.label?.trim() ?? null;
  }, []);

  const searchAddress = useCallback(async (query: string) => {
    const response = await fetch(`/api/geocode/search?q=${encodeURIComponent(query)}`, { cache: 'no-store' });
    if (!response.ok) throw new Error('Address search is currently unavailable.');
    const payload = (await response.json()) as { results?: GeocodeSearchResult[] };
    return payload.results ?? [];
  }, []);

  useEffect(() => {
    let cancelled = false;

    const loadActiveRideRoute = async () => {
      if (activeRideDirectRouteCoordinates.length < 2) {
        setActiveRideRouteCoordinates([]);
        return;
      }

      try {
        const response = await fetch(
          `/api/road-route?coordinates=${encodeURIComponent(activeRideDirectRouteKey)}`,
          { cache: 'no-store' }
        );

        if (!response.ok) {
          throw new Error('Failed to load road route.');
        }

        const payload = (await response.json()) as { coordinates?: [number, number][] };
        if (cancelled) return;

        setActiveRideRouteCoordinates(
          Array.isArray(payload.coordinates) && payload.coordinates.length >= 2
            ? payload.coordinates
            : activeRideDirectRouteCoordinates
        );
      } catch {
        if (!cancelled) {
          setActiveRideRouteCoordinates(activeRideDirectRouteCoordinates);
        }
      }
    };

    void loadActiveRideRoute();

    return () => {
      cancelled = true;
    };
  }, [activeRideDirectRouteKey]);

  const loadActiveRide = useCallback(async () => {
    if (!canBook || isLoadingRideRef.current) return;
    isLoadingRideRef.current = true;
    try {
      const { ride } = await getPassengerActiveRide();
      const previousRide = lastKnownRideRef.current;
      if (previousRideStatusRef.current && !ride) {
        const nextHandoff = previousRideStatusRef.current === 'cancelled' ? 'cancelled' : 'completed';
        setRideHandoff(nextHandoff);
        if (nextHandoff === 'completed' && previousRide) {
          writeRideFeedbackPrompt({
            rideId: previousRide.id,
            subjectLabel: 'Driver',
            subjectName: previousRide.driver?.name ?? null,
            role: 'passenger',
          });
          router.replace('/passenger/home');
        }
      }
      previousRideStatusRef.current = ride?.status ?? previousRideStatusRef.current;
      setActiveRide(ride);
      lastKnownRideRef.current = ride;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load active ride.');
    } finally {
      isLoadingRideRef.current = false;
      setLoadingActiveRide(false);
    }
  }, [canBook, router]);

  useEffect(() => {
    void loadActiveRide();
  }, [loadActiveRide]);

  useEffect(() => {
    if (activeRide) previousRideStatusRef.current = activeRide.status;
    lastKnownRideRef.current = activeRide;
  }, [activeRide]);

  useEffect(() => {
    if (restoredDraftRef.current || loadingActiveRide || activeRide || typeof window === 'undefined') return;
    restoredDraftRef.current = true;
    const raw = readDraftFromSessionStorage();
    if (!raw) return;
    try {
      const draft = JSON.parse(raw) as {
        pickup?: { latitude: number; longitude: number } | null;
        dropoff?: { latitude: number; longitude: number } | null;
        pickupStreetLabel?: string | null;
        dropoffStreetLabel?: string | null;
      };
      if (draft.pickup && Number.isFinite(draft.pickup.latitude) && Number.isFinite(draft.pickup.longitude)) {
        setPickup(draft.pickup);
      }
      if (draft.dropoff && Number.isFinite(draft.dropoff.latitude) && Number.isFinite(draft.dropoff.longitude)) {
        setDropoff(draft.dropoff);
      }
      setPickupStreetLabel(draft.pickupStreetLabel ?? null);
      setDropoffStreetLabel(draft.dropoffStreetLabel ?? null);
    } catch {
      clearDraftSessionStorage();
    }
  }, [activeRide, loadingActiveRide]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (activeRide || (!pickup && !dropoff)) {
      clearDraftSessionStorage();
      return;
    }
    writeDraftToSessionStorage(JSON.stringify({ pickup, dropoff, pickupStreetLabel, dropoffStreetLabel }));
  }, [activeRide, dropoff, dropoffStreetLabel, pickup, pickupStreetLabel]);

  useBookingRealtime({
    enabled: Boolean(canBook),
    onUpdate: (payload) => {
      if (payload.type === 'ride.updated') void loadActiveRide();
    },
  });

  useEffect(() => {
    if (!userLocation) return;

    setInitialUserCenter((current) => current ?? [userLocation.longitude, userLocation.latitude]);
  }, [userLocation]);

  useEffect(() => {
    if (!activeRide) return;
    const timer = setInterval(() => {
      if (typeof document !== 'undefined' && document.visibilityState !== 'visible') return;
      void loadActiveRide();
    }, 30000);
    return () => clearInterval(timer);
  }, [activeRide, loadActiveRide]);

  useEffect(() => {
    const map = mapInstance;
    if (!map || activeRide) return;
    const handleClick = (event: MapMouseEvent) => {
      const point = { latitude: event.lngLat.lat, longitude: event.lngLat.lng };
      if (!pickup) {
        setPickup(point);
        setPickupStreetLabel(null);
        setIsResolvingPickupStreet(false);
        pickupLookupKeyRef.current = null;
      } else {
        setDropoff(point);
        setDropoffStreetLabel(null);
        setIsResolvingDropoffStreet(false);
        dropoffLookupKeyRef.current = null;
      }
      setError(null);
      setQuote(null);
      setRideHandoff(null);
      setSheetExpanded(true);
      lastQuotedRouteKeyRef.current = null;
    };
    map.on('click', handleClick);
    return () => {
      map.off('click', handleClick);
    };
  }, [activeRide, mapInstance, pickup]);

  useEffect(() => {
    if (!userLocation || activeRide || pickup || dropoff) return;
    setPickup({ latitude: userLocation.latitude, longitude: userLocation.longitude });
    setPickupStreetLabel(null);
    setPickupQuery('Current location');
    setIsResolvingPickupStreet(false);
    pickupLookupKeyRef.current = null;
    setQuote(null);
    lastQuotedRouteKeyRef.current = null;
  }, [activeRide, dropoff, pickup, userLocation]);

  useEffect(() => {
    if (!mapInstance || activeRide || !initialUserCenter || hasAutoCenteredMapRef.current) return;

    const shouldLockToCurrentLocation = !pickup || pointsMatch(pickup, initialUserPoint);
    if (!shouldLockToCurrentLocation) return;

    const timeout = window.setTimeout(() => {
      hasAutoCenteredMapRef.current = true;
      mapInstance.flyTo({
        center: initialUserCenter,
        zoom: 15.5,
        duration: 700,
      });
    }, 120);

    return () => {
      window.clearTimeout(timeout);
    };
  }, [activeRide, initialUserCenter, initialUserPoint, mapInstance, pickup]);

  useEffect(() => {
    if (!mapInstance) return;

    const frame = window.requestAnimationFrame(() => {
      mapInstance.resize();
    });
    const timeout = window.setTimeout(() => {
      mapInstance.resize();
    }, 220);

    return () => {
      window.cancelAnimationFrame(frame);
      window.clearTimeout(timeout);
    };
  }, [activeRide, mapInstance, quote, sheetExpanded]);

  useEffect(() => {
    if (!mapInstance) return;

    const timeout = window.setTimeout(() => {
      const bottomPadding = activeRide ? 300 : sheetExpanded ? 230 : 130;

      if (activeRide) {
        const activeRideBounds: [number, number][] =
          displayedActiveRideRouteCoordinates.length >= 2
            ? [...displayedActiveRideRouteCoordinates]
            : [...activeRideDirectRouteCoordinates];
        if (initialUserCenter) {
          activeRideBounds.unshift(initialUserCenter);
        }

        mapInstance.fitBounds(
          getBoundsFromCoordinates(activeRideBounds),
          {
            padding: {
              top: 120,
              right: 32,
              left: 32,
              bottom: bottomPadding,
            },
            maxZoom: 15,
            duration: 700,
          }
        );
        return;
      }

      if (pickup && dropoff) {
        const pickupIsCurrentLocation = pointsMatch(pickup, initialUserPoint);

        if (quote?.routeCoordinates && quote.routeCoordinates.length >= 2) {
          mapInstance.fitBounds(getBoundsFromCoordinates(quote.routeCoordinates), {
            padding: {
              top: 120,
              right: 24,
              left: 24,
              bottom: bottomPadding,
            },
            maxZoom: 16,
            duration: 650,
          });
          return;
        }

        if (pickupIsCurrentLocation) {
          mapInstance.flyTo({
            center: [pickup.longitude, pickup.latitude],
            zoom: Math.max(mapInstance.getZoom(), 15),
            duration: 450,
          });
          return;
        }

        mapInstance.fitBounds(
          [
            [pickup.longitude, pickup.latitude],
            [dropoff.longitude, dropoff.latitude],
          ],
          {
            padding: {
              top: 120,
              right: 24,
              left: 24,
              bottom: bottomPadding,
            },
            maxZoom: 15.5,
            duration: 550,
          }
        );
        return;
      }

      if (pickup) {
        mapInstance.flyTo({
          center: [pickup.longitude, pickup.latitude],
          zoom: 15,
          duration: 700,
        });
      }
    }, 160);

    return () => {
      window.clearTimeout(timeout);
    };
  }, [
    activeRide,
    activeRideDirectRouteKey,
    displayedActiveRideRouteKey,
    dropoff,
    initialUserCenter,
    initialUserPoint,
    mapInstance,
    pickup,
    quote,
    sheetExpanded,
  ]);

  useEffect(() => {
    if (pickupStreetLabel && pickup && (!pickupQuery.trim() || pickupQuery === 'Current location' || pickupQuery === markerLabel(pickup))) {
      setPickupQuery(pickupStreetLabel);
    }
  }, [pickup, pickupQuery, pickupStreetLabel]);

  useEffect(() => {
    if (dropoffStreetLabel && dropoff && (!dropoffQuery.trim() || dropoffQuery === markerLabel(dropoff))) {
      setDropoffQuery(dropoffStreetLabel);
    }
  }, [dropoff, dropoffQuery, dropoffStreetLabel]);

  useEffect(() => {
    if (activeRide || error || quote || pickupSuggestions.length > 0 || dropoffSuggestions.length > 0) {
      setSheetExpanded(true);
    }
  }, [activeRide, dropoffSuggestions.length, error, pickupSuggestions.length, quote]);

  useEffect(() => {
    if (!pickup || activeRide) return;
    const pickupKey = markerLabel(pickup);
    if (pickupLookupKeyRef.current === pickupKey) return;
    let cancelled = false;
    setIsResolvingPickupStreet(true);
    const timer = setTimeout(() => {
      void (async () => {
        try {
          const label = await resolveStreetLabel(pickup);
          if (cancelled) return;
          setPickupStreetLabel(label);
          pickupLookupKeyRef.current = pickupKey;
        } catch {
          if (cancelled) return;
          setPickupStreetLabel(null);
          pickupLookupKeyRef.current = pickupKey;
        } finally {
          if (!cancelled) setIsResolvingPickupStreet(false);
        }
      })();
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [activeRide, pickup, resolveStreetLabel]);

  useEffect(() => {
    if (!dropoff || activeRide) return;
    const dropoffKey = markerLabel(dropoff);
    if (dropoffLookupKeyRef.current === dropoffKey) return;
    let cancelled = false;
    setIsResolvingDropoffStreet(true);
    const timer = setTimeout(() => {
      void (async () => {
        try {
          const label = await resolveStreetLabel(dropoff);
          if (cancelled) return;
          setDropoffStreetLabel(label);
          dropoffLookupKeyRef.current = dropoffKey;
        } catch {
          if (cancelled) return;
          setDropoffStreetLabel(null);
          dropoffLookupKeyRef.current = dropoffKey;
        } finally {
          if (!cancelled) setIsResolvingDropoffStreet(false);
        }
      })();
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [activeRide, dropoff, resolveStreetLabel]);

  const applyPickupSuggestion = (result: GeocodeSearchResult) => {
    setPickup({ latitude: result.latitude, longitude: result.longitude });
    setPickupStreetLabel(result.label);
    setPickupSuggestions([]);
    setPickupQuery(result.label);
    setSheetExpanded(true);
    setQuote(null);
    setError(null);
    setRideHandoff(null);
    lastQuotedRouteKeyRef.current = null;
    pickupLookupKeyRef.current = `${result.latitude.toFixed(5)},${result.longitude.toFixed(5)}`;
  };

  const applyDropoffSuggestion = (result: GeocodeSearchResult) => {
    setDropoff({ latitude: result.latitude, longitude: result.longitude });
    setDropoffStreetLabel(result.label);
    setDropoffSuggestions([]);
    setDropoffQuery(result.label);
    setSheetExpanded(true);
    setQuote(null);
    setError(null);
    setRideHandoff(null);
    lastQuotedRouteKeyRef.current = null;
    dropoffLookupKeyRef.current = `${result.latitude.toFixed(5)},${result.longitude.toFixed(5)}`;
  };

  const handlePickupQueryChange = (value: string) => {
    if (userLocation) return;

    setPickupQuery(value);
    if (pickup && value.trim() !== (pickupStreetLabel ?? markerLabel(pickup))) {
      setPickup(null);
      setPickupStreetLabel(null);
      pickupLookupKeyRef.current = null;
      lastQuotedRouteKeyRef.current = null;
      setQuote(null);
    }
    setError(null);
    setRideHandoff(null);
  };

  const handleDropoffQueryChange = (value: string) => {
    setDropoffQuery(value);
    if (dropoff && value.trim() !== (dropoffStreetLabel ?? markerLabel(dropoff))) {
      setDropoff(null);
      setDropoffStreetLabel(null);
      dropoffLookupKeyRef.current = null;
      lastQuotedRouteKeyRef.current = null;
      setQuote(null);
    }
    setError(null);
    setRideHandoff(null);
  };

  useEffect(() => {
    if (activeRide || userLocation) {
      setPickupSuggestions([]);
      setIsSearchingPickup(false);
      return;
    }
    const query = pickupQuery.trim();
    if (query.length < 3) {
      setPickupSuggestions([]);
      setIsSearchingPickup(false);
      return;
    }
    let cancelled = false;
    setIsSearchingPickup(true);
    const timer = setTimeout(() => {
      void (async () => {
        try {
          const results = await searchAddress(query);
          if (!cancelled) setPickupSuggestions(results);
        } catch {
          if (!cancelled) setPickupSuggestions([]);
        } finally {
          if (!cancelled) setIsSearchingPickup(false);
        }
      })();
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [activeRide, pickupQuery, searchAddress, userLocation]);

  useEffect(() => {
    if (activeRide) return;
    const query = dropoffQuery.trim();
    if (query.length < 3) {
      setDropoffSuggestions([]);
      setIsSearchingDropoff(false);
      return;
    }
    let cancelled = false;
    setIsSearchingDropoff(true);
    const timer = setTimeout(() => {
      void (async () => {
        try {
          const results = await searchAddress(query);
          if (!cancelled) setDropoffSuggestions(results);
        } catch {
          if (!cancelled) setDropoffSuggestions([]);
        } finally {
          if (!cancelled) setIsSearchingDropoff(false);
        }
      })();
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [activeRide, dropoffQuery, searchAddress]);

  const getQuote = useCallback(
    async (options?: { force?: boolean }) => {
      if (!pickup || !dropoff) return;
      const routeKey = `${pickup.latitude.toFixed(6)},${pickup.longitude.toFixed(6)}|${dropoff.latitude.toFixed(6)},${dropoff.longitude.toFixed(6)}`;
      if (!options?.force && lastQuotedRouteKeyRef.current === routeKey) return;
      setIsQuoting(true);
      setError(null);
      try {
        const response = await quoteOnDemand({
          pickup,
          dropoff,
          pickupLabel: pickupStreetLabel ?? `Pinned pickup (${markerLabel(pickup)})`,
          dropoffLabel: dropoffStreetLabel ?? `Pinned dropoff (${markerLabel(dropoff)})`,
        });
        setQuote({
          totalFare: response.fare.totalFare,
          distanceKm: response.fare.distanceKm,
          estimatedDurationMin: response.fare.estimatedDurationMin,
          routeCoordinates: response.routeCoordinates,
        });
        lastQuotedRouteKeyRef.current = routeKey;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to calculate quote.';
        const isServiceIssue =
          message.includes('AUTH_UNAVAILABLE') ||
          message.includes('service unavailable') ||
          message.includes('NetworkError') ||
          message.includes('fetch');
        setError(
          isServiceIssue
            ? 'Quote service is temporarily unavailable. Check connection or retry in a few moments.'
            : message
        );
      } finally {
        setIsQuoting(false);
      }
    },
    [dropoff, dropoffStreetLabel, pickup, pickupStreetLabel]
  );

  useEffect(() => {
    if (activeRide || !pickup || !dropoff) {
      if (autoQuoteTimerRef.current) {
        clearTimeout(autoQuoteTimerRef.current);
        autoQuoteTimerRef.current = null;
      }
      return;
    }
    if (autoQuoteTimerRef.current) clearTimeout(autoQuoteTimerRef.current);
    autoQuoteTimerRef.current = setTimeout(() => void getQuote(), 450);
    return () => {
      if (autoQuoteTimerRef.current) {
        clearTimeout(autoQuoteTimerRef.current);
        autoQuoteTimerRef.current = null;
      }
    };
  }, [activeRide, dropoff, getQuote, pickup]);

  const resetPins = () => {
    if (autoQuoteTimerRef.current) {
      clearTimeout(autoQuoteTimerRef.current);
      autoQuoteTimerRef.current = null;
    }
    lastQuotedRouteKeyRef.current = null;
    pickupLookupKeyRef.current = null;
    dropoffLookupKeyRef.current = null;
    setPickup(null);
    setDropoff(null);
    setPickupStreetLabel(null);
    setDropoffStreetLabel(null);
    setPickupQuery('');
    setDropoffQuery('');
    setPickupSuggestions([]);
    setDropoffSuggestions([]);
    setIsSearchingPickup(false);
    setIsSearchingDropoff(false);
    setIsResolvingPickupStreet(false);
    setIsResolvingDropoffStreet(false);
    setQuote(null);
    setError(null);
    setSheetExpanded(false);
    clearDraftSessionStorage();
  };

  const confirmBooking = async () => {
    if (!pickup || !dropoff) return;
    setIsBooking(true);
    setError(null);
    try {
      const { ride } = await createOnDemand({
        pickup,
        dropoff,
        pickupLabel: pickupStreetLabel ?? `Pinned pickup (${markerLabel(pickup)})`,
        dropoffLabel: dropoffStreetLabel ?? `Pinned dropoff (${markerLabel(dropoff)})`,
      });
      previousRideStatusRef.current = ride.status;
      setRideHandoff(null);
      setActiveRide({
        ...ride,
        driver: null,
      });
      setSheetExpanded(false);
      setQuote(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send ride request.');
    } finally {
      setIsBooking(false);
    }
  };

  const cancelBooking = async () => {
    if (!activeRide) return;
    setIsCancelling(true);
    setError(null);
    try {
      await cancelOnDemandRide(activeRide.id);
      previousRideStatusRef.current = 'cancelled';
      setRideHandoff('cancelled');
      setActiveRide(null);
      lastKnownRideRef.current = null;
      resetPins();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to cancel ride.');
    } finally {
      setIsCancelling(false);
    }
  };

  if (!currentUser || currentUser.role !== 'passenger' || loadingActiveRide) {
    return <OnDemandLoadingSkeleton />;
  }

  const canCancel = Boolean(activeRide && ['searching', 'matched', 'en_route'].includes(activeRide.status));
  const bookingMapCenter: [number, number] = initialUserCenter ?? FALLBACK_MAP_CENTER;
  const activeRideMapCenter: [number, number] =
    activeRide && initialUserCenter
      ? initialUserCenter
      : activeRide
        ? [activeRide.pickupLongitude, activeRide.pickupLatitude]
        : bookingMapCenter;
  const draftCopy = getDraftCopy({
    pickup: Boolean(pickup),
    dropoff: Boolean(dropoff),
    quote: Boolean(quote),
    isBooking,
  });
  const isSheetOpen = sheetExpanded;
  const showCompactDraftSheet = !activeRide && !isSheetOpen;
  const pickupPreviewText =
    pickupQuery.trim() ||
    pickupStreetLabel ||
    (pickup ? 'Pinned pickup selected' : 'Use current location or search pickup');
  const destinationPreviewText =
    dropoffQuery.trim() ||
    dropoffStreetLabel ||
    (dropoff ? 'Destination selected' : 'Where are you going?');
  const primaryDraftActionLabel = !pickup
    ? 'Set pickup'
    : !dropoff
      ? 'Set destination'
      : isQuoting
        ? 'Calculating fare...'
        : !quote
          ? 'Preparing fare...'
          : isBooking
            ? 'Sending ride request...'
            : 'Confirm Ride';

  return (
    <PassengerAppShell
      title="Book"
      subtitle="Request a ride or follow the live route."
      topContext="Book"
      headerVariant="compact"
      headerSurface="minimal"
      preserveBottomNavSpace={false}
      showHeader={false}
      contentClassName="!max-w-full !space-y-0 !px-0 !py-0"
    >
      <div className="relative h-dvh min-h-[34rem] overflow-hidden rounded-none bg-background">
          <Map
            ref={(instance) => setMapInstance(instance)}
            center={activeRide ? activeRideMapCenter : bookingMapCenter}
            zoom={13}
            className="absolute inset-0 z-0 h-full w-full bg-muted/20"
            attributionControl={false}
          >
            <MapControls position="top-right" showZoom showLocate showFullscreen />
            {activeRide ? (
              <>
                {userLocation ? (
                  <CoordinateMarker
                    longitude={userLocation.longitude}
                    latitude={userLocation.latitude}
                    tone="current"
                    label="Your current location"
                  />
                ) : null}
                <CoordinateMarker
                  longitude={activeRide.pickupLongitude}
                  latitude={activeRide.pickupLatitude}
                  tone="pickup"
                  label={activeRide.pickupLocation}
                />
                <CoordinateMarker
                  longitude={activeRide.dropoffLongitude}
                  latitude={activeRide.dropoffLatitude}
                  tone="dropoff"
                  label={activeRide.dropoffLocation}
                />
                {typeof activeRide.driverLatitude === 'number' && typeof activeRide.driverLongitude === 'number' ? (
                  <CoordinateMarker
                    longitude={activeRide.driverLongitude}
                    latitude={activeRide.driverLatitude}
                    tone="driver"
                    label="Driver live location"
                  />
                ) : null}
                {displayedActiveRideRouteCoordinates.length >= 2 ? (
                  <MapRoute coordinates={displayedActiveRideRouteCoordinates} width={5} opacity={0.82} />
                ) : null}
              </>
            ) : (
              <>
                {pickup ? (
                  <CoordinateMarker
                    longitude={pickup.longitude}
                    latitude={pickup.latitude}
                    tone="pickup"
                    label={pickupStreetLabel ?? 'Pickup'}
                  />
                ) : null}
                {dropoff ? (
                  <CoordinateMarker
                    longitude={dropoff.longitude}
                    latitude={dropoff.latitude}
                    tone="dropoff"
                    label={dropoffStreetLabel ?? 'Dropoff'}
                  />
                ) : null}
                {quote?.routeCoordinates && quote.routeCoordinates.length >= 2 ? (
                  <MapRoute coordinates={quote.routeCoordinates} width={5} opacity={0.82} />
                ) : null}
              </>
            )}
          </Map>

          <div className="pointer-events-none absolute inset-x-0 top-0 z-10 h-16 bg-gradient-to-b from-background/25 to-transparent" />
          <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-36 bg-gradient-to-t from-background/85 via-background/28 to-transparent" />

          <div className="pointer-events-none absolute inset-x-0 bottom-0 z-30 mx-auto w-full max-w-screen-sm px-3">
            <ActiveBookingSheetShell
              ariaLabel={activeRide ? 'Active ride details' : 'Book a ride'}
              height={
                activeRide
                  ? isSheetOpen
                    ? undefined
                    : activeRide.driver
                      ? ACTIVE_BOOKING_SHEET_COLLAPSED_HEIGHT
                      : COLLAPSED_SEARCHING_RIDE_HEIGHT
                  : isSheetOpen
                    ? 'min(78dvh, 42rem)'
                    : 'calc(10.25rem + 6.85rem + env(safe-area-inset-bottom))'
              }
              maxHeight={activeRide && isSheetOpen ? ACTIVE_BOOKING_SHEET_EXPANDED_MAX_HEIGHT : undefined}
            >
              <ActiveBookingSheetHandle
                expanded={isSheetOpen}
                onClick={() => setSheetExpanded((current) => !current)}
                expandedLabel={activeRide ? 'Collapse active ride sheet' : 'Collapse booking sheet'}
                collapsedLabel={activeRide ? 'Expand active ride sheet' : 'Expand booking sheet'}
              />

              {showCompactDraftSheet ? (
                <div className="px-4 pb-[calc(6.1rem+env(safe-area-inset-bottom))] pt-1">
                  <button
                    type="button"
                    onClick={() => setSheetExpanded(true)}
                    className="w-full text-left transition"
                    aria-label="Expand booking sheet"
                  >
                    <div className="flex items-start gap-3 border-b border-border/45 py-3.5">
                      <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                        <MapPin className="h-4 w-4" />
                      </div>
                      <p className="line-clamp-2 min-h-[2.6rem] min-w-0 flex-1 text-sm font-medium leading-snug">
                        {pickupPreviewText}
                      </p>
                    </div>
                    <div className="flex items-start gap-3 py-3.5">
                      <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-secondary/10 text-secondary">
                        <Navigation className="h-4 w-4" />
                      </div>
                      <p className="line-clamp-2 min-h-[2.6rem] min-w-0 flex-1 text-sm font-medium leading-snug">
                        {destinationPreviewText}
                      </p>
                    </div>
                  </button>
                </div>
              ) : activeRide && !isSheetOpen ? (
                <ActiveBookingSheetLayout active={false}>
                  <ActiveBookingSheetBody active={false} className="pb-3 pt-1">
                    <button
                      type="button"
                      onClick={() => setSheetExpanded(true)}
                      className="w-full text-left transition"
                      aria-label="Expand active ride sheet"
                    >
                      <ActiveDriverCompactProfile ride={activeRide} />
                      <ActiveBookingCompactLocationRow
                        icon={<MapPin className="h-4 w-4" />}
                        toneClassName="bg-primary/10 text-primary"
                        label="Pickup"
                        value={activeRide.pickupLocation}
                        trailing={!activeRide.driver ? <StatusBadge status={activeRide.status} /> : null}
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
                    <Button
                      variant="outline"
                      className="h-12 w-full rounded-full"
                      onClick={() => void cancelBooking()}
                      disabled={isCancelling || !canCancel}
                    >
                      {isCancelling ? (
                        'Cancelling ride...'
                      ) : (
                        <>
                          <XCircle className="mr-2 h-4 w-4" />
                          Cancel Ride
                        </>
                      )}
                    </Button>
                  </ActiveBookingSheetFooter>
                </ActiveBookingSheetLayout>
              ) : (
                <ActiveBookingSheetLayout active={Boolean(activeRide)}>
                  <ActiveBookingSheetBody active={Boolean(activeRide)}>
                    {rideHandoff ? (
                      <div className="mt-2 rounded-[1.4rem] border border-primary/20 bg-primary/8 px-4 py-3 text-sm text-muted-foreground">
                        {rideHandoff === 'cancelled'
                          ? 'Your last ride was cancelled. You can request another ride anytime.'
                          : 'Your last ride is no longer active. You can request another ride or review your activity.'}
                      </div>
                    ) : null}

                    {!activeRide ? (
                      <div className="mt-3 space-y-4">
                        <div className="space-y-2">
                          <h2 className="text-xl font-semibold tracking-tight">{draftCopy.title}</h2>
                          <p className="text-sm text-muted-foreground">{draftCopy.subtitle}</p>
                        </div>

                        <div className="space-y-3 border-t border-border/45 pt-2">
                          <SearchField
                            value={pickupQuery.trim() || pickupStreetLabel || (pickup ? 'Current location' : '')}
                            onChange={handlePickupQueryChange}
                            onFocus={() => setSheetExpanded(true)}
                            placeholder={userLocation ? 'Current location' : 'Search pickup'}
                            searching={!userLocation && isSearchingPickup}
                            suggestions={userLocation ? [] : pickupSuggestions}
                            onSelect={applyPickupSuggestion}
                            icon={<MapPin className="h-4 w-4" />}
                            iconToneClassName="bg-primary/10 text-primary"
                            readOnly={Boolean(userLocation)}
                          />

                          <div className="border-t border-border/45 pt-3">
                            <SearchField
                              value={dropoffQuery}
                              onChange={handleDropoffQueryChange}
                              onFocus={() => setSheetExpanded(true)}
                              placeholder="Where are you going?"
                              searching={isSearchingDropoff}
                              suggestions={dropoffSuggestions}
                              onSelect={applyDropoffSuggestion}
                              icon={<Navigation className="h-4 w-4" />}
                              iconToneClassName="bg-secondary/10 text-secondary"
                            />
                          </div>
                        </div>

                        {quote ? (
                          <div className="space-y-3 border-t border-primary/18 pt-4">
                            <div className="flex items-center gap-2">
                              <Sparkles className="h-4 w-4 text-primary" />
                              <p className="text-sm font-semibold">Route ready</p>
                            </div>
                            <div className="grid grid-cols-3 gap-2 text-xs">
                              <PassengerMetricPill label="Distance" value={`${quote.distanceKm} km`} />
                              <PassengerMetricPill label="ETA" value={`${quote.estimatedDurationMin} min`} />
                              <PassengerMetricPill label="Fare" value={formatPeso(quote.totalFare)} />
                            </div>
                          </div>
                        ) : pickup && dropoff ? (
                          <div className="border-t border-border/45 pt-3 text-sm text-muted-foreground">
                            {isQuoting
                              ? 'Calculating fare and travel time...'
                              : 'Fare and travel time appear here as soon as the route is ready.'}
                          </div>
                        ) : null}

                        {error ? <InlineErrorState message={error} onRetry={() => void getQuote({ force: true })} /> : null}
                      </div>
                    ) : (
                      <div className="mt-4 space-y-5">
                        <ActiveBookingHero
                          eyebrow="Active ride"
                          title={
                            activeRide.status === 'searching'
                              ? 'Searching for driver'
                              : activeRide.status === 'matched' || activeRide.status === 'en_route'
                                ? 'Driver on the way'
                                : 'Ride in progress'
                          }
                          subtitle={getRideSubtitle(activeRide)}
                          trailing={<StatusBadge status={activeRide.status} />}
                        />

                        {activeRide.status === 'searching' ? (
                          <div className="border-t border-primary/18 pt-4">
                            <div className="flex items-start gap-3">
                              <div className="mt-1 flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/12 text-primary">
                                <Navigation className="h-4 w-4" />
                              </div>
                              <div className="space-y-1.5">
                                <p className="text-sm font-semibold">Finding the next available driver</p>
                                <p className="text-sm text-muted-foreground">
                                  Your request is already in the nearest TODA queue. Keep this screen open to follow the match in real time.
                                </p>
                              </div>
                            </div>
                          </div>
                        ) : null}

                        <ActiveDriverProfile ride={activeRide} />

                        <div className="space-y-4 border-t border-border/45 pt-4">
                          <ActiveBookingRouteSummary
                            icon={<MapPin className="h-4 w-4" />}
                            toneClassName="bg-primary/10 text-primary"
                            pickup={activeRide.pickupLocation}
                            dropoff={activeRide.dropoffLocation}
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
                            <PassengerMetricPill label="Fare" value={formatPeso(activeRide.fare)} />
                          </div>

                          <p className="text-sm text-muted-foreground">
                            {activeRide.driverId && activeRide.status !== 'searching'
                              ? 'Driver assignment is automatic through the nearest TODA dispatch flow. This view keeps updating as the ride progresses.'
                              : `${BRAND_NAME} is assigning the ride automatically through the nearest TODA terminal.`}
                          </p>

                          {error ? <InlineErrorState message={error} onRetry={() => void loadActiveRide()} /> : null}

                          {!canCancel ? (
                            <p className="text-xs text-muted-foreground">
                              Passenger cancellation is only available before the trip starts.
                            </p>
                          ) : null}
                        </div>
                      </div>
                    )}
                  </ActiveBookingSheetBody>

                  <ActiveBookingSheetFooter>
                    {!activeRide ? (
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          onClick={resetPins}
                          disabled={isQuoting || isBooking || (!pickup && !dropoff)}
                          className="h-12 rounded-full px-5"
                        >
                          Reset
                        </Button>
                        <Button
                          className="h-12 flex-1 rounded-full bg-primary text-base font-semibold"
                          onClick={() => void confirmBooking()}
                          disabled={!pickup || !dropoff || !quote || isBooking || isQuoting}
                        >
                          {primaryDraftActionLabel}
                        </Button>
                      </div>
                    ) : (
                      <Button
                        variant="outline"
                        className="h-12 w-full rounded-full"
                        onClick={() => void cancelBooking()}
                        disabled={isCancelling || !canCancel}
                      >
                        {isCancelling ? (
                          'Cancelling ride...'
                        ) : (
                          <>
                            <XCircle className="mr-2 h-4 w-4" />
                            Cancel Ride
                          </>
                        )}
                        </Button>
                      )}
                  </ActiveBookingSheetFooter>
                </ActiveBookingSheetLayout>
              )}
            </ActiveBookingSheetShell>
          </div>
      </div>
    </PassengerAppShell>
  );
}
