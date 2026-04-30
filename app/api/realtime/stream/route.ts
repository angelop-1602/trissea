import { randomUUID } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { requireActorTenantId, requireBookingProfile, toBookingActor } from '@/lib/booking/auth';
import { SSE_KEEPALIVE_MS } from '@/lib/booking/constants';
import { bookingErrorResponse, getRequestIdFromHeaders } from '@/lib/booking/http';
import { bookingEvents } from '@/lib/booking/events';
import type { BookingEventPayload } from '@/lib/booking/types';
import { createSupabaseAdminClient } from '@/lib/supabase/server';
import { logInfo, logWarn } from '@/lib/observability/log';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface RealtimeChangePayload {
  table?: string;
  eventType?: string;
  new?: Record<string, unknown>;
  old?: Record<string, unknown>;
}

function toRealtimeType(table?: string): BookingEventPayload['type'] | null {
  if (table === 'Ride') return 'ride.updated';
  if (table === 'Reservation') return 'reservation.updated';
  if (table === 'TODATerminal') return 'terminal.updated';
  if (table === 'DriverPresence') return 'presence.updated';
  return null;
}

export async function GET(request: NextRequest) {
  const requestId = getRequestIdFromHeaders(request.headers);

  try {
    const user = await requireBookingProfile(request);
    const actor = toBookingActor(user);
    const tenantId = actor.role === 'passenger' ? null : requireActorTenantId(actor);

    const encoder = new TextEncoder();

    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        let closed = false;

        const sendRaw = (value: string) => {
          if (closed) return;
          try {
            controller.enqueue(encoder.encode(value));
          } catch {
            closed = true;
          }
        };

        const sendEvent = (payload: BookingEventPayload) => {
          sendRaw(`event: booking-update\ndata: ${JSON.stringify(payload)}\n\n`);
        };

        // Send an immediate frame so clients confirm the stream is live.
        sendRaw(': connected\n\n');
        logInfo('realtime.sse.connected', {
          requestId,
          route: '/api/realtime/stream',
          userId: actor.id,
          tenantId: tenantId ?? undefined,
        });

        const keepalive = setInterval(() => {
          sendRaw(': keepalive\n\n');
        }, SSE_KEEPALIVE_MS);

        const onInternalEvent = (payload: BookingEventPayload) => {
          if (actor.role === 'passenger') {
            const record = payload.payload as Record<string, unknown> | undefined;
            const passengerId = String(
              record?.passengerId ??
                (record?.new as Record<string, unknown> | undefined)?.passengerId ??
                (record?.old as Record<string, unknown> | undefined)?.passengerId ??
                ''
            );

            if (passengerId !== actor.id) return;
          } else if (payload.tenantId !== tenantId) {
            return;
          }

          sendEvent(payload);
        };

        bookingEvents.on('booking-update', onInternalEvent);

        let supabase: ReturnType<typeof createSupabaseAdminClient> | null = null;
        let channel: ReturnType<ReturnType<typeof createSupabaseAdminClient>['channel']> | null = null;

        const onPostgresChange = (payload: RealtimeChangePayload) => {
          const type = toRealtimeType(payload.table);
          if (!type) return;

          const row = payload.new ?? payload.old ?? {};
          const rowTenantId = String(row.tenantId ?? '');
          const rowPassengerId = String(row.passengerId ?? '');

          if (actor.role === 'passenger') {
            if (type !== 'ride.updated' && type !== 'reservation.updated') {
              return;
            }

            if (rowPassengerId !== actor.id) {
              return;
            }
          } else if (rowTenantId !== tenantId) {
            return;
          }

          const entityId = String(row.id ?? row.driverId ?? row.terminalId ?? 'unknown');

          sendEvent({
            type,
            tenantId: rowTenantId,
            entityId,
            payload,
            timestamp: new Date().toISOString(),
          });
        };

        try {
          supabase = createSupabaseAdminClient();
          const channelName = `booking-stream-${actor.id}-${randomUUID()}`;
          channel = supabase.channel(channelName, {
            config: {
              broadcast: { self: false },
            },
          });

          if (actor.role === 'passenger') {
            channel
              .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'Ride', filter: `passengerId=eq.${actor.id}` },
                onPostgresChange
              )
              .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'Reservation', filter: `passengerId=eq.${actor.id}` },
                onPostgresChange
              )
              .subscribe((status) => {
                if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
                  sendRaw(': realtime-channel-error\n\n');
                  logWarn('realtime.supabase.channel_error', {
                    requestId,
                    route: '/api/realtime/stream',
                    userId: actor.id,
                    tenantId: tenantId ?? undefined,
                    code: status,
                  });
                }
              });
          } else {
            channel
              .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'Ride', filter: `tenantId=eq.${tenantId}` },
                onPostgresChange
              )
              .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'Reservation', filter: `tenantId=eq.${tenantId}` },
                onPostgresChange
              )
              .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'TODATerminal', filter: `tenantId=eq.${tenantId}` },
                onPostgresChange
              )
              .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'DriverPresence', filter: `tenantId=eq.${tenantId}` },
                onPostgresChange
              )
              .subscribe((status) => {
                if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
                  sendRaw(': realtime-channel-error\n\n');
                  logWarn('realtime.supabase.channel_error', {
                    requestId,
                    route: '/api/realtime/stream',
                    userId: actor.id,
                    tenantId: tenantId ?? undefined,
                    code: status,
                  });
                }
              });
          }

        } catch {
          // Keep SSE alive even if external realtime subscription is unavailable.
          sendRaw(': realtime-init-failed\n\n');
          logWarn('realtime.supabase.init_failed', {
            requestId,
            route: '/api/realtime/stream',
            userId: actor.id,
            tenantId: tenantId ?? undefined,
          });
        }

        const cleanup = async () => {
          if (closed) return;
          closed = true;
          clearInterval(keepalive);
          bookingEvents.off('booking-update', onInternalEvent);
          if (supabase && channel) {
            await supabase.removeChannel(channel);
          }
          try {
            controller.close();
          } catch {
            // no-op
          }
          logInfo('realtime.sse.disconnected', {
            requestId,
            route: '/api/realtime/stream',
            userId: actor.id,
            tenantId: tenantId ?? undefined,
          });
        };

        request.signal.addEventListener('abort', () => {
          void cleanup();
        });
      },
      cancel() {
        // Handled by request abort and stream close.
      },
    });

    return new NextResponse(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
        'X-Accel-Buffering': 'no',
        'x-request-id': requestId,
      },
    });
  } catch (error) {
    return bookingErrorResponse(error, requestId);
  }
}
