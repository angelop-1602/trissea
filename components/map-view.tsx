'use client';

import MapLibreGL from 'maplibre-gl';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Map,
  MapControls,
  MapMarker,
  MapRoute,
  MarkerContent,
  MarkerTooltip,
  type MapRef,
} from '@/components/ui/map';
import { cn } from '@/lib/utils';
import { useUserLocation } from '@/hooks/use-user-location';

type MarkerTone = 'default' | 'terminal' | 'driver' | 'ride' | 'region';

export interface MapPoint {
  id: string;
  latitude: number;
  longitude: number;
  label: string;
  description?: string;
  tone?: MarkerTone;
}

interface MapViewProps {
  pickupLocation?: string;
  dropoffLocation?: string;
  driverLocation?: { latitude: number; longitude: number };
  driverLocationLabel?: string;
  routeWaypoints?: Array<{ latitude: number; longitude: number }>;
  pickupLat?: number;
  pickupLon?: number;
  dropoffLat?: number;
  dropoffLon?: number;
  points?: MapPoint[];
  showRoute?: boolean;
  height?: string;
  className?: string;
  autoFitMode?: 'always' | 'initial';
  controlsPosition?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
}

const FALLBACK_CENTER: [number, number] = [121.7268, 17.6136];
const EMPTY_COORDINATES: [number, number][] = [];
const EMPTY_ROUTE_WAYPOINTS: Array<{ latitude: number; longitude: number }> = [];
const EMPTY_POINTS: MapPoint[] = [];

const toneClasses: Record<MarkerTone, string> = {
  default: 'bg-muted-foreground',
  terminal: 'bg-chart-4',
  driver: 'bg-chart-2',
  ride: 'bg-primary',
  region: 'bg-chart-3',
};

function isCoordinate(value?: number) {
  return typeof value === 'number' && Number.isFinite(value);
}

function toCoordinateKey(longitude: number, latitude: number) {
  return `${longitude.toFixed(6)},${latitude.toFixed(6)}`;
}

function parseRouteRequestKey(routeRequestKey: string): [number, number][] {
  if (!routeRequestKey) {
    return EMPTY_COORDINATES;
  }

  return routeRequestKey.split(';').map((coordinate) => {
    const [longitude, latitude] = coordinate.split(',');
    return [Number(longitude), Number(latitude)] as [number, number];
  });
}

function resolveNextRouteState(
  current: [number, number][],
  next: [number, number][]
): [number, number][] {
  if (current.length !== next.length) {
    return next;
  }

  for (let index = 0; index < current.length; index += 1) {
    if (current[index][0] !== next[index][0] || current[index][1] !== next[index][1]) {
      return next;
    }
  }

  return current;
}

function MarkerDot({ tone = 'default' }: { tone?: MarkerTone }) {
  return (
    <div
      className={cn(
        'h-3.5 w-3.5 rounded-full border-2 border-background shadow-md ring-2 ring-background/70',
        toneClasses[tone]
      )}
    />
  );
}

export function MapView({
  pickupLocation = 'Pickup Location',
  dropoffLocation = 'Dropoff Location',
  driverLocation,
  driverLocationLabel = 'Driver location',
  routeWaypoints = EMPTY_ROUTE_WAYPOINTS,
  pickupLat,
  pickupLon,
  dropoffLat,
  dropoffLon,
  points = EMPTY_POINTS,
  showRoute = true,
  height = 'h-64',
  className,
  autoFitMode = 'always',
  controlsPosition = 'bottom-right',
}: MapViewProps) {
  const mapRef = useRef<MapRef | null>(null);
  const hasAutoFitRef = useRef(false);
  const [roadRouteCoordinates, setRoadRouteCoordinates] = useState<[number, number][]>(EMPTY_COORDINATES);
  const [initialMapCenter, setInitialMapCenter] = useState<[number, number] | null>(null);

  const hasPickup = isCoordinate(pickupLat) && isCoordinate(pickupLon);
  const hasDropoff = isCoordinate(dropoffLat) && isCoordinate(dropoffLon);
  const shouldCenterOnUser =
    !hasPickup &&
    !hasDropoff &&
    !driverLocation &&
    routeWaypoints.length === 0 &&
    points.length === 0;
  const userLocation = useUserLocation({
    enabled: shouldCenterOnUser,
    watch: true,
    minimumDistanceMeters: 10,
  });
  const userCenter: [number, number] | null = userLocation
    ? [userLocation.longitude, userLocation.latitude]
    : null;
  const hasSceneCoordinates =
    hasPickup ||
    hasDropoff ||
    Boolean(driverLocation) ||
    routeWaypoints.length > 0 ||
    points.length > 0 ||
    Boolean(userCenter);

  const coordinatesToFit = useMemo<[number, number][]>(() => {
    const coordinates: [number, number][] = [];

    if (hasPickup) {
      coordinates.push([pickupLon!, pickupLat!]);
    }
    if (hasDropoff) {
      coordinates.push([dropoffLon!, dropoffLat!]);
    }
    if (driverLocation) {
      coordinates.push([driverLocation.longitude, driverLocation.latitude]);
    }
    for (const waypoint of routeWaypoints) {
      coordinates.push([waypoint.longitude, waypoint.latitude]);
    }
    for (const point of points) {
      coordinates.push([point.longitude, point.latitude]);
    }

    if (coordinates.length > 0) {
      return coordinates;
    }

    if (userCenter) {
      return [userCenter];
    }

    return [FALLBACK_CENTER];
  }, [
    driverLocation,
    dropoffLat,
    dropoffLon,
    hasDropoff,
    hasPickup,
    pickupLat,
    pickupLon,
    points,
    routeWaypoints,
    userCenter,
  ]);

  const explicitRouteRequestKey = useMemo(
    () => {
      const coordinateKeys = routeWaypoints
        .filter(
          (waypoint) =>
            typeof waypoint.latitude === 'number' &&
            Number.isFinite(waypoint.latitude) &&
            typeof waypoint.longitude === 'number' &&
            Number.isFinite(waypoint.longitude)
        )
        .map((waypoint) => toCoordinateKey(waypoint.longitude, waypoint.latitude));

      return coordinateKeys.length >= 2 ? coordinateKeys.join(';') : '';
    },
    [routeWaypoints]
  );

  const routeRequestKey = useMemo(() => {
    if (explicitRouteRequestKey) {
      return explicitRouteRequestKey;
    }

    const coordinateKeys: string[] = [];

    if (hasPickup) {
      coordinateKeys.push(toCoordinateKey(pickupLon!, pickupLat!));
    }
    if (driverLocation) {
      coordinateKeys.push(toCoordinateKey(driverLocation.longitude, driverLocation.latitude));
    }
    if (hasDropoff) {
      coordinateKeys.push(toCoordinateKey(dropoffLon!, dropoffLat!));
    }

    return coordinateKeys.length >= 2 ? coordinateKeys.join(';') : '';
  }, [driverLocation, dropoffLat, dropoffLon, explicitRouteRequestKey, hasDropoff, hasPickup, pickupLat, pickupLon]);

  const routeCoordinates = useMemo<[number, number][]>(() => parseRouteRequestKey(routeRequestKey), [routeRequestKey]);

  useEffect(() => {
    if (autoFitMode !== 'initial' || initialMapCenter || !hasSceneCoordinates) return;

    setInitialMapCenter(coordinatesToFit[0]);
  }, [autoFitMode, coordinatesToFit, hasSceneCoordinates, initialMapCenter]);

  useEffect(() => {
    let isCancelled = false;

    const updateRoadRouteCoordinates = (next: [number, number][]) => {
      setRoadRouteCoordinates((current) => resolveNextRouteState(current, next));
    };

    const loadRoadRoute = async () => {
      if (!showRoute || routeCoordinates.length < 2 || !routeRequestKey) {
        updateRoadRouteCoordinates(EMPTY_COORDINATES);
        return;
      }

      try {
        const response = await fetch(
          `/api/road-route?coordinates=${encodeURIComponent(routeRequestKey)}`,
          { cache: 'no-store' }
        );

        if (!response.ok) {
          throw new Error('Failed to load routed line');
        }

        const payload = (await response.json()) as { coordinates?: [number, number][] };

        if (isCancelled) return;

        if (Array.isArray(payload.coordinates) && payload.coordinates.length >= 2) {
          updateRoadRouteCoordinates(payload.coordinates);
          return;
        }

        updateRoadRouteCoordinates(EMPTY_COORDINATES);
      } catch {
        if (!isCancelled) {
          updateRoadRouteCoordinates(EMPTY_COORDINATES);
        }
      }
    };

    void loadRoadRoute();

    return () => {
      isCancelled = true;
    };
  }, [routeCoordinates, routeRequestKey, showRoute]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || coordinatesToFit.length === 0) return;
    if (autoFitMode === 'initial' && hasAutoFitRef.current) return;

    if (coordinatesToFit.length === 1) {
      map.easeTo({
        center: coordinatesToFit[0],
        zoom: 13,
        duration: 500,
      });
      if (hasSceneCoordinates) {
        hasAutoFitRef.current = true;
      }
      return;
    }

    const bounds = new MapLibreGL.LngLatBounds(coordinatesToFit[0], coordinatesToFit[0]);
    for (const coordinate of coordinatesToFit) {
      bounds.extend(coordinate);
    }
    map.fitBounds(bounds, {
      duration: 700,
      maxZoom: 15,
      padding: 80,
    });
    if (hasSceneCoordinates) {
      hasAutoFitRef.current = true;
    }
  }, [autoFitMode, coordinatesToFit, hasSceneCoordinates]);

  const mapCenter = autoFitMode === 'initial'
    ? initialMapCenter ?? coordinatesToFit[0]
    : coordinatesToFit[0];

  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-xl border border-border',
        height,
        className
      )}
    >
      <Map
        ref={mapRef}
        center={mapCenter}
        zoom={13}
        attributionControl={false}
        className="h-full w-full"
        cooperativeGestures
      >
        <MapControls position={controlsPosition} showZoom showLocate showFullscreen />

        {showRoute && routeCoordinates.length >= 2 ? (
          <MapRoute
            coordinates={roadRouteCoordinates.length >= 2 ? roadRouteCoordinates : routeCoordinates}
            width={4}
            opacity={0.75}
          />
        ) : null}

        {hasPickup ? (
          <MapMarker longitude={pickupLon!} latitude={pickupLat!}>
            <MarkerContent>
              <MarkerDot tone="ride" />
            </MarkerContent>
            <MarkerTooltip>{pickupLocation}</MarkerTooltip>
          </MapMarker>
        ) : null}

        {hasDropoff ? (
          <MapMarker longitude={dropoffLon!} latitude={dropoffLat!}>
            <MarkerContent>
              <MarkerDot tone="default" />
            </MarkerContent>
            <MarkerTooltip>{dropoffLocation}</MarkerTooltip>
          </MapMarker>
        ) : null}

        {driverLocation ? (
          <MapMarker longitude={driverLocation.longitude} latitude={driverLocation.latitude}>
            <MarkerContent>
              <div className="relative">
                <div className="absolute inset-0 rounded-full bg-primary/40 blur-sm" />
                <MarkerDot tone="driver" />
              </div>
            </MarkerContent>
            <MarkerTooltip>{driverLocationLabel}</MarkerTooltip>
          </MapMarker>
        ) : null}

        {points.map((point) => (
          <MapMarker key={point.id} longitude={point.longitude} latitude={point.latitude}>
            <MarkerContent>
              <MarkerDot tone={point.tone ?? 'default'} />
            </MarkerContent>
            <MarkerTooltip>
              <div className="space-y-0.5">
                <p className="font-medium">{point.label}</p>
                {point.description ? <p className="text-[11px] opacity-80">{point.description}</p> : null}
              </div>
            </MarkerTooltip>
          </MapMarker>
        ))}
      </Map>
    </div>
  );
}
