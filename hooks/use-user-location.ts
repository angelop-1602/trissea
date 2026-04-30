'use client';

import { useEffect, useRef, useState } from 'react';

export interface UserLocation {
  latitude: number;
  longitude: number;
}

interface UseUserLocationOptions {
  enabled?: boolean;
  watch?: boolean;
  minimumDistanceMeters?: number;
}

const LAST_LOCATION_STORAGE_KEY = 'trissea:user-location:last';

function isValidLocation(value: unknown): value is UserLocation {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const candidate = value as Partial<UserLocation>;
  return (
    typeof candidate.latitude === 'number' &&
    Number.isFinite(candidate.latitude) &&
    candidate.latitude >= -90 &&
    candidate.latitude <= 90 &&
    typeof candidate.longitude === 'number' &&
    Number.isFinite(candidate.longitude) &&
    candidate.longitude >= -180 &&
    candidate.longitude <= 180
  );
}

function readLastLocation() {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    const raw = window.localStorage.getItem(LAST_LOCATION_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    return isValidLocation(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function writeLastLocation(location: UserLocation) {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    window.localStorage.setItem(LAST_LOCATION_STORAGE_KEY, JSON.stringify(location));
  } catch {
    // Storage can be blocked; live geolocation still works for this session.
  }
}

export function getLocationDistanceMeters(left: UserLocation, right: UserLocation) {
  const earthRadiusMeters = 6371000;
  const toRadians = (degrees: number) => (degrees * Math.PI) / 180;
  const latitudeDelta = toRadians(right.latitude - left.latitude);
  const longitudeDelta = toRadians(right.longitude - left.longitude);
  const leftLatitude = toRadians(left.latitude);
  const rightLatitude = toRadians(right.latitude);

  const haversine =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(leftLatitude) *
      Math.cos(rightLatitude) *
      Math.sin(longitudeDelta / 2) ** 2;
  const normalizedHaversine = Math.min(1, Math.max(0, haversine));

  return earthRadiusMeters * 2 * Math.atan2(Math.sqrt(normalizedHaversine), Math.sqrt(1 - normalizedHaversine));
}

export function useUserLocation({
  enabled = true,
  watch = true,
  minimumDistanceMeters = 0,
}: UseUserLocationOptions = {}) {
  const [location, setLocation] = useState<UserLocation | null>(() => (enabled ? readLastLocation() : null));
  const lastAcceptedLocationRef = useRef<UserLocation | null>(location);

  useEffect(() => {
    if (!enabled || typeof navigator === 'undefined' || !('geolocation' in navigator)) {
      return;
    }

    let isCancelled = false;

    const handlePosition = (position: GeolocationPosition) => {
      if (isCancelled) return;

      const nextLocation = {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
      };

      const previousLocation = lastAcceptedLocationRef.current;
      if (
        previousLocation &&
        minimumDistanceMeters > 0 &&
        getLocationDistanceMeters(previousLocation, nextLocation) < minimumDistanceMeters
      ) {
        return;
      }

      lastAcceptedLocationRef.current = nextLocation;
      setLocation(nextLocation);
      writeLastLocation(nextLocation);
    };

    const handleError = () => {
      // Keep the last known location and let consumers decide their fallback.
    };

    const options: PositionOptions = {
      enableHighAccuracy: true,
      maximumAge: 15000,
      timeout: 12000,
    };

    if (watch) {
      const watchId = navigator.geolocation.watchPosition(handlePosition, handleError, options);
      return () => {
        isCancelled = true;
        navigator.geolocation.clearWatch(watchId);
      };
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        handlePosition(position);
      },
      handleError,
      options
    );

    return () => {
      isCancelled = true;
    };
  }, [enabled, minimumDistanceMeters, watch]);

  useEffect(() => {
    if (!enabled) return;

    setLocation((currentLocation) => {
      if (currentLocation) {
        lastAcceptedLocationRef.current = currentLocation;
        return currentLocation;
      }

      const lastLocation = readLastLocation();
      lastAcceptedLocationRef.current = lastLocation;
      return lastLocation;
    });
  }, [enabled]);

  return location;
}
