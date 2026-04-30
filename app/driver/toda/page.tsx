'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  Clock3,
  ListOrdered,
  MapPin,
  RefreshCw,
  Route,
} from 'lucide-react';
import type { TODATerminal } from '@prisma/client';
import { DriverAppShell } from '@/components/driver/driver-app-shell';
import { InlineErrorState, PageLoadingState } from '@/components/page-state';
import { StatusBadge } from '@/components/status-badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useStore } from '@/lib/store-context';
import {
  getTodaTerminalRequests,
  getTodaTerminals,
  type DriverTodaTerminalContext,
  type TerminalOnDemandRequest,
} from '@/lib/booking/client';
import { useBookingRealtime } from '@/hooks/use-booking-realtime';
import { cn } from '@/lib/utils';

function formatCurrency(value: number) {
  return new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: 'PHP',
    maximumFractionDigits: 0,
  }).format(value);
}

function formatUpdatedAt(value: Date | null) {
  if (!value) return 'Waiting for board updates';

  return `Updated ${new Intl.DateTimeFormat('en-PH', {
    hour: 'numeric',
    minute: '2-digit',
  }).format(value)}`;
}

function formatRequestedAt(value: string | Date) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return 'Request time unavailable';

  return new Intl.DateTimeFormat('en-PH', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(date);
}

function sortTerminals(
  terminals: TODATerminal[],
  assignedTerminalId: string | null,
) {
  return [...terminals].sort((left, right) => {
    if (assignedTerminalId) {
      if (left.id === assignedTerminalId && right.id !== assignedTerminalId) {
        return -1;
      }
      if (right.id === assignedTerminalId && left.id !== assignedTerminalId) {
        return 1;
      }
    }

    return left.name.localeCompare(right.name);
  });
}

function QueueRow({
  ride,
  tone = 'default',
  children,
}: {
  ride: TerminalOnDemandRequest;
  tone?: 'default' | 'primary';
  children?: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        'space-y-3 px-4 py-4',
        tone === 'primary' ? 'bg-primary/[0.05]' : 'bg-transparent',
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1 space-y-1">
          <p className="text-sm font-medium text-foreground">
            {ride.pickupLocation}
          </p>
          <p className="text-xs text-muted-foreground">
            to {ride.dropoffLocation}
          </p>
        </div>
        <StatusBadge status={ride.status} />
      </div>

      <div className="grid grid-cols-3 gap-2">
        <div className="rounded-[1rem] border border-border/50 bg-background/70 px-3 py-2">
          <p className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
            Passenger
          </p>
          <p className="mt-1 text-sm font-medium text-foreground">
            {ride.passenger.name}
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
        <div className="rounded-[1rem] border border-border/50 bg-background/70 px-3 py-2">
          <p className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
            Requested
          </p>
          <p className="mt-1 text-sm font-medium text-foreground">
            {formatRequestedAt(ride.createdAt)}
          </p>
        </div>
      </div>

      {children ? <div>{children}</div> : null}
    </div>
  );
}

function RequestSectionSkeleton({
  rows = 2,
}: {
  rows?: number;
}) {
  return (
    <div className="overflow-hidden rounded-[1.85rem] border border-border/60 bg-background/58">
      {Array.from({ length: rows }).map((_, index) => (
        <div
          key={index}
          className={cn(
            'space-y-3 px-4 py-4',
            index > 0 ? 'border-t border-border/55' : '',
          )}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-2">
              <Skeleton className="h-4 w-40 rounded-full" />
              <Skeleton className="h-3 w-56 rounded-full" />
            </div>
            <Skeleton className="h-6 w-20 rounded-full" />
          </div>
          <div className="grid grid-cols-3 gap-2">
            <Skeleton className="h-16 rounded-[1rem]" />
            <Skeleton className="h-16 rounded-[1rem]" />
            <Skeleton className="h-16 rounded-[1rem]" />
          </div>
        </div>
      ))}
    </div>
  );
}

export default function DriverTodaPage() {
  const { currentUser } = useStore();
  const [terminals, setTerminals] = useState<TODATerminal[]>([]);
  const [driverContext, setDriverContext] =
    useState<DriverTodaTerminalContext | null>(null);
  const [selectedTerminalId, setSelectedTerminalId] = useState<string | null>(
    null,
  );
  const [requests, setRequests] = useState<TerminalOnDemandRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingRequests, setLoadingRequests] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);
  const loadingTerminalsRef = useRef(false);
  const loadingRequestsRef = useRef(false);

  const isDriver = currentUser?.role === 'driver';

  const loadTerminals = useCallback(
    async (reason: 'initial' | 'manual' | 'realtime' = 'manual') => {
      if (!isDriver || loadingTerminalsRef.current) return;

      loadingTerminalsRef.current = true;
      if (reason !== 'initial') {
        setIsRefreshing(true);
      }

      try {
        const response = await getTodaTerminals();
        const nextContext = response.driverContext ?? null;
        const orderedTerminals = sortTerminals(
          response.terminals,
          nextContext?.assignedTerminalId ?? null,
        );

        setDriverContext(nextContext);
        setTerminals(orderedTerminals);
        setSelectedTerminalId((current) => {
          if (
            current &&
            orderedTerminals.some((terminal) => terminal.id === current)
          ) {
            return current;
          }

          if (
            nextContext?.assignedTerminalId &&
            orderedTerminals.some(
              (terminal) => terminal.id === nextContext.assignedTerminalId,
            )
          ) {
            return nextContext.assignedTerminalId;
          }

          return orderedTerminals[0]?.id ?? null;
        });
        setError(null);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : 'Failed to load TODA terminals.',
        );
      } finally {
        loadingTerminalsRef.current = false;
        setLoading(false);
        if (reason === 'initial') {
          setIsRefreshing(false);
        }
      }
    },
    [isDriver],
  );

  const loadRequests = useCallback(
    async (
      terminalId: string | null,
      reason: 'initial' | 'manual' | 'realtime' | 'selection' = 'manual',
    ) => {
      if (!isDriver || !terminalId || loadingRequestsRef.current) {
        if (!terminalId) {
          setRequests([]);
          setLoadingRequests(false);
          setIsRefreshing(false);
        }
        return;
      }

      loadingRequestsRef.current = true;
      if (reason === 'initial' || reason === 'selection') {
        setLoadingRequests(true);
      } else {
        setIsRefreshing(true);
      }

      try {
        const response = await getTodaTerminalRequests(terminalId);
        setRequests(response.rides);
        setLastUpdatedAt(new Date());
        setError(null);
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : 'Failed to load terminal requests.',
        );
      } finally {
        loadingRequestsRef.current = false;
        setLoadingRequests(false);
        setIsRefreshing(false);
      }
    },
    [isDriver],
  );

  useEffect(() => {
    void loadTerminals('initial');
  }, [loadTerminals]);

  useEffect(() => {
    if (!selectedTerminalId) {
      setRequests([]);
      return;
    }

    void loadRequests(selectedTerminalId, loading ? 'initial' : 'selection');
  }, [loadRequests, loading, selectedTerminalId]);

  useBookingRealtime({
    enabled: Boolean(isDriver),
    onUpdate: (payload) => {
      if (
        payload.type === 'ride.updated' ||
        payload.type === 'terminal.updated'
      ) {
        void loadTerminals('realtime');
        void loadRequests(selectedTerminalId, 'realtime');
      }
    },
  });

  const selectedTerminal =
    terminals.find((terminal) => terminal.id === selectedTerminalId) ?? null;
  const isAssignedTerminalSelected =
    Boolean(driverContext?.assignedTerminalId) &&
    driverContext?.assignedTerminalId === selectedTerminalId;

  const queuedRequests = useMemo(
    () =>
      requests
        .filter((ride) => ride.status === 'searching')
        .sort(
          (left, right) =>
            new Date(left.createdAt).getTime() -
            new Date(right.createdAt).getTime(),
        ),
    [requests],
  );

  const assignedRequests = useMemo(
    () =>
      requests.filter((ride) =>
        ['matched', 'en_route', 'arrived', 'in_trip'].includes(ride.status),
      ),
    [requests],
  );

  const myTerminalRide =
    assignedRequests.find((ride) => ride.driverId === currentUser?.id) ?? null;
  const otherAssignedRequests = assignedRequests.filter(
    (ride) => ride.driverId !== currentUser?.id,
  );

  if (!currentUser || currentUser.role !== 'driver' || loading) {
    return (
      <PageLoadingState
        label="Loading terminal board..."
        className="theme-driver min-h-screen bg-background text-foreground"
      />
    );
  }

  return (
    <DriverAppShell>
      <div className="space-y-5">
        <section className="space-y-4 rounded-[2rem] border border-primary/15 bg-primary/[0.06] px-4 py-5">
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-1">
              <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                Terminal board
              </p>
              <h1 className="text-2xl font-semibold tracking-tight text-foreground">
                {selectedTerminal?.name ?? 'No terminal selected'}
              </h1>
              <p className="text-sm leading-relaxed text-muted-foreground">
                {driverContext?.assignedTerminalId
                  ? isAssignedTerminalSelected
                    ? 'Your assigned TODA is selected first. Other tenant terminals stay visible here only as dispatch context.'
                    : 'You are viewing another tenant terminal. This board shows terminal request context, not your driver queue position.'
                  : 'No assigned TODA was found on your driver profile, so this page shows tenant terminal request context only.'}
              </p>
            </div>
            <div className="flex flex-col items-end gap-2">
              <span
                className={cn(
                  'inline-flex rounded-full px-3 py-1 text-xs font-medium',
                  driverContext?.assignedTerminalId
                    ? 'bg-primary/12 text-primary'
                    : 'bg-muted text-muted-foreground',
                )}
              >
                {driverContext?.assignedTerminalId
                  ? 'Assigned terminal first'
                  : 'Tenant-wide board'}
              </span>
              <span className="inline-flex items-center gap-1 rounded-full border border-border/55 bg-background/75 px-3 py-1 text-xs text-muted-foreground">
                <Clock3 className="h-3.5 w-3.5" />
                {formatUpdatedAt(lastUpdatedAt)}
              </span>
            </div>
          </div>

          {terminals.length > 1 ? (
            <div className="flex flex-wrap gap-2">
              {terminals.map((terminal) => {
                const isSelected = terminal.id === selectedTerminalId;
                const isAssigned =
                  driverContext?.assignedTerminalId === terminal.id;

                return (
                  <button
                    key={terminal.id}
                    type="button"
                    onClick={() => setSelectedTerminalId(terminal.id)}
                    className={cn(
                      'inline-flex items-center gap-2 rounded-full border px-3 py-2 text-xs font-medium transition-colors',
                      isSelected
                        ? 'border-primary/25 bg-primary text-primary-foreground'
                        : 'border-border/55 bg-background/72 text-foreground hover:bg-background',
                    )}
                  >
                    <span>{terminal.name}</span>
                    {isAssigned ? (
                      <span
                        className={cn(
                          'rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em]',
                          isSelected
                            ? 'bg-background/18 text-primary-foreground'
                            : 'bg-primary/12 text-primary',
                        )}
                      >
                        Assigned
                      </span>
                    ) : null}
                  </button>
                );
              })}
            </div>
          ) : null}

          {selectedTerminal ? (
            <div className="grid grid-cols-3 gap-2">
              <div className="rounded-[1rem] border border-border/55 bg-background/72 px-3 py-3">
                <p className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                  Location
                </p>
                <p className="mt-1 text-sm font-medium text-foreground">
                  {selectedTerminal.location}
                </p>
              </div>
              <div className="rounded-[1rem] border border-border/55 bg-background/72 px-3 py-3">
                <p className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                  Waiting
                </p>
                <p className="mt-1 text-sm font-medium text-foreground">
                  {queuedRequests.length}
                </p>
              </div>
              <div className="rounded-[1rem] border border-border/55 bg-background/72 px-3 py-3">
                <p className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                  Active
                </p>
                <p className="mt-1 text-sm font-medium text-foreground">
                  {assignedRequests.length}
                </p>
              </div>
            </div>
          ) : null}

          {isRefreshing ? (
            <div className="inline-flex items-center gap-2 rounded-full border border-border/55 bg-background/75 px-3 py-1 text-xs text-muted-foreground">
              <RefreshCw className="h-3.5 w-3.5 animate-spin" />
              Refreshing terminal board
            </div>
          ) : null}
        </section>

        {error ? (
          <InlineErrorState
            message={error}
            onRetry={() => {
              void loadTerminals('manual');
              void loadRequests(selectedTerminalId, 'manual');
            }}
          />
        ) : null}

        {terminals.length === 0 ? (
          <section className="rounded-[1.85rem] border border-border/60 bg-background/58 px-4 py-5">
            <div className="flex items-start gap-3">
              <div className="rounded-full border border-border/60 bg-muted/45 p-2 text-muted-foreground">
                <AlertCircle className="h-4 w-4" />
              </div>
              <div className="space-y-1">
                <h2 className="text-sm font-semibold tracking-tight text-foreground">
                  No terminal board available
                </h2>
                <p className="text-sm leading-relaxed text-muted-foreground">
                  No TODA terminals are configured for your tenant yet.
                </p>
              </div>
            </div>
          </section>
        ) : (
          <>
            {myTerminalRide ? (
              <section className="space-y-3">
                <div className="space-y-1 px-1">
                  <h2 className="text-sm font-semibold tracking-tight text-foreground">
                    Your ride in this terminal
                  </h2>
                  <p className="text-xs text-muted-foreground">
                    This is the ride in the selected terminal that already belongs
                    to your account.
                  </p>
                </div>

                <div className="overflow-hidden rounded-[1.85rem] border border-border/60 bg-background/58">
                  <QueueRow ride={myTerminalRide} tone="primary">
                    <Link href="/driver/active-trip" className="block">
                      <Button className="h-11 w-full rounded-full">
                        Open Active Trip
                      </Button>
                    </Link>
                  </QueueRow>
                </div>
              </section>
            ) : null}

            <section className="space-y-3">
              <div className="space-y-1 px-1">
                <h2 className="text-sm font-semibold tracking-tight text-foreground">
                  Waiting for dispatch
                </h2>
                <p className="text-xs text-muted-foreground">
                  Requests are shown oldest first based on the current terminal
                  dispatch order. This is request order, not your driver queue
                  position.
                </p>
              </div>

              {loadingRequests ? (
                <RequestSectionSkeleton rows={2} />
              ) : queuedRequests.length === 0 ? (
                <section className="rounded-[1.85rem] border border-border/60 bg-background/58 px-4 py-5">
                  <div className="flex items-start gap-3">
                    <div className="rounded-full border border-border/60 bg-muted/45 p-2 text-muted-foreground">
                      <ListOrdered className="h-4 w-4" />
                    </div>
                    <div className="space-y-1">
                      <h3 className="text-sm font-medium text-foreground">
                        No requests are waiting here
                      </h3>
                      <p className="text-sm leading-relaxed text-muted-foreground">
                        There are no searching on-demand requests in this terminal
                        right now.
                      </p>
                    </div>
                  </div>
                </section>
              ) : (
                <div className="overflow-hidden rounded-[1.85rem] border border-border/60 bg-background/58">
                  {queuedRequests.map((ride, index) => (
                    <div
                      key={ride.id}
                      className={cn(
                        index > 0 ? 'border-t border-border/55' : '',
                      )}
                    >
                      <QueueRow ride={ride} />
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section className="space-y-3">
              <div className="space-y-1 px-1">
                <h2 className="text-sm font-semibold tracking-tight text-foreground">
                  Already assigned in this terminal
                </h2>
                <p className="text-xs text-muted-foreground">
                  These requests are no longer waiting in the terminal board
                  because they already belong to a driver.
                </p>
              </div>

              {loadingRequests ? (
                <RequestSectionSkeleton rows={1} />
              ) : otherAssignedRequests.length === 0 ? (
                <section className="rounded-[1.85rem] border border-border/60 bg-background/58 px-4 py-5">
                  <div className="flex items-start gap-3">
                    <div className="rounded-full border border-border/60 bg-muted/45 p-2 text-muted-foreground">
                      <Route className="h-4 w-4" />
                    </div>
                    <div className="space-y-1">
                      <h3 className="text-sm font-medium text-foreground">
                        No other active rides in this terminal
                      </h3>
                      <p className="text-sm leading-relaxed text-muted-foreground">
                        No matched or in-progress rides from other drivers are
                        visible in the selected terminal right now.
                      </p>
                    </div>
                  </div>
                </section>
              ) : (
                <div className="overflow-hidden rounded-[1.85rem] border border-border/60 bg-background/58">
                  {otherAssignedRequests.map((ride, index) => (
                    <div
                      key={ride.id}
                      className={cn(
                        index > 0 ? 'border-t border-border/55' : '',
                      )}
                    >
                      <QueueRow ride={ride} />
                    </div>
                  ))}
                </div>
              )}
            </section>
          </>
        )}

        <section className="rounded-[1.75rem] border border-primary/20 bg-primary/8 px-4 py-4">
          <div className="flex items-start gap-3">
            <div className="rounded-full border border-primary/20 bg-primary/10 p-2 text-primary">
              <MapPin className="h-4 w-4" />
            </div>
            <div className="space-y-1">
              <p className="text-sm font-medium text-foreground">
                What this page is for
              </p>
              <p className="text-xs leading-relaxed text-muted-foreground">
                This page monitors terminal request activity. It does not show your
                driver queue position because the current backend does not expose a
                driver-line position model in the driver app.
              </p>
            </div>
          </div>
        </section>
      </div>
    </DriverAppShell>
  );
}
