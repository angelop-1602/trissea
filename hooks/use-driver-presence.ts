'use client';

import { useEffect } from 'react';

interface UseDriverPresenceOptions {
  enabled: boolean;
  intervalMs?: number;
}

function postPresence(payload: Record<string, unknown>, keepalive = false) {
  return fetch('/api/bookings/driver/presence', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
    keepalive,
  });
}

export function useDriverPresence({ enabled, intervalMs = 10000 }: UseDriverPresenceOptions) {
  useEffect(() => {
    if (!enabled) return;

    let cancelled = false;
    let inFlight = false;

    const sendPresence = async () => {
      if (cancelled || inFlight) return;
      inFlight = true;

      try {
        if (!('geolocation' in navigator)) {
          await postPresence({ isOnline: true }).catch(() => null);
          return;
        }

        await new Promise<void>((resolve) => {
          navigator.geolocation.getCurrentPosition(
            async (position) => {
              await postPresence({
                isOnline: true,
                latitude: position.coords.latitude,
                longitude: position.coords.longitude,
                heading:
                  typeof position.coords.heading === 'number' ? position.coords.heading : undefined,
                accuracy: position.coords.accuracy,
              }).catch(() => null);
              resolve();
            },
            async () => {
              await postPresence({ isOnline: true }).catch(() => null);
              resolve();
            },
            {
              enableHighAccuracy: true,
              maximumAge: 8000,
              timeout: 5000,
            }
          );
        });
      } finally {
        inFlight = false;
      }
    };

    void sendPresence();
    const interval = setInterval(() => {
      void sendPresence();
    }, intervalMs);

    return () => {
      cancelled = true;
      clearInterval(interval);
      void postPresence({ isOnline: false }, true).catch(() => null);
    };
  }, [enabled, intervalMs]);
}
