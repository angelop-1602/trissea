'use client';

import { useEffect, useRef } from 'react';
import type { BookingEventPayload } from '@/lib/booking/types';

interface UseBookingRealtimeOptions {
  enabled?: boolean;
  onUpdate?: (payload: BookingEventPayload) => void;
  dedupeWindowMs?: number;
}

export function useBookingRealtime({
  enabled = true,
  onUpdate,
  dedupeWindowMs = 400,
}: UseBookingRealtimeOptions) {
  const onUpdateRef = useRef<typeof onUpdate>(onUpdate);
  const lastEventAtRef = useRef<Map<string, number>>(new Map());

  useEffect(() => {
    onUpdateRef.current = onUpdate;
  }, [onUpdate]);

  useEffect(() => {
    if (!enabled) return;

    const source = new EventSource('/api/realtime/stream', { withCredentials: true });

    const handler = (event: MessageEvent<string>) => {
      try {
        const payload = JSON.parse(event.data) as BookingEventPayload;

        const key = `${payload.type}:${payload.entityId}`;
        const now = Date.now();
        const lastEventAt = lastEventAtRef.current.get(key) ?? 0;

        if (now - lastEventAt < dedupeWindowMs) {
          return;
        }

        lastEventAtRef.current.set(key, now);
        onUpdateRef.current?.(payload);
      } catch {
        // ignore malformed payloads
      }
    };

    const errorHandler = () => {
      // EventSource auto-reconnects; no-op is intentional.
    };

    source.addEventListener('booking-update', handler as EventListener);
    source.addEventListener('error', errorHandler as EventListener);

    return () => {
      source.removeEventListener('booking-update', handler as EventListener);
      source.removeEventListener('error', errorHandler as EventListener);
      source.close();
    };
  }, [enabled, dedupeWindowMs]);
}
