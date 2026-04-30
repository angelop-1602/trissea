'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Ride } from '@prisma/client';
import { BellRing, Clock3, MapPin, Navigation } from 'lucide-react';
import { useBookingRealtime } from '@/hooks/use-booking-realtime';
import { getDriverAssignedRides } from '@/lib/booking/client';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { StatusBadge } from '@/components/status-badge';

interface DriverAssignmentNotifierProps {
  enabled: boolean;
  driverId?: string | null;
}

const STORAGE_PREFIX = 'trissea:driver-assignment-notifications';

function getStorageKey(driverId?: string | null) {
  return `${STORAGE_PREFIX}:${driverId ?? 'unknown'}:seen`;
}

function readSeenAssignments(driverId?: string | null) {
  if (typeof window === 'undefined') {
    return new Set<string>();
  }

  try {
    const raw = window.sessionStorage.getItem(getStorageKey(driverId));
    const parsed = raw ? (JSON.parse(raw) as unknown) : [];
    return new Set(Array.isArray(parsed) ? parsed.filter((value): value is string => typeof value === 'string') : []);
  } catch {
    return new Set<string>();
  }
}

function writeSeenAssignments(driverId: string | null | undefined, seenIds: Set<string>) {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    window.sessionStorage.setItem(getStorageKey(driverId), JSON.stringify(Array.from(seenIds)));
  } catch {
    // If storage is blocked, the in-memory ref still prevents repeat dialogs during this mount.
  }
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: 'PHP',
    maximumFractionDigits: 0,
  }).format(value);
}

function getNotificationCopy(ride: Ride) {
  switch (ride.status) {
    case 'matched':
      return {
        title: 'New ride assigned',
        description: 'A passenger ride has been matched to you. Open Active to start heading to pickup.',
      };
    case 'en_route':
      return {
        title: 'Assigned ride needs action',
        description: 'Continue to the pickup point and mark your arrival from Active.',
      };
    case 'arrived':
      return {
        title: 'Passenger pickup is ready',
        description: 'Open Active when the passenger boards so you can start the trip.',
      };
    case 'in_trip':
      return {
        title: 'Trip already in progress',
        description: 'Open Active to continue the live trip workflow.',
      };
    default:
      return {
        title: 'Ride assigned',
        description: 'Open Active to continue the assigned ride workflow.',
      };
  }
}

export function DriverAssignmentNotifier({ enabled, driverId }: DriverAssignmentNotifierProps) {
  const [open, setOpen] = useState(false);
  const [assignment, setAssignment] = useState<Ride | null>(null);
  const [assignedCount, setAssignedCount] = useState(0);
  const isLoadingRef = useRef(false);
  const seenAssignmentsRef = useRef<Set<string> | null>(null);

  const getSeenAssignments = useCallback(() => {
    if (!seenAssignmentsRef.current) {
      seenAssignmentsRef.current = readSeenAssignments(driverId);
    }

    return seenAssignmentsRef.current;
  }, [driverId]);

  const markSeen = useCallback(
    (rideId: string) => {
      const seenAssignments = getSeenAssignments();
      seenAssignments.add(rideId);
      writeSeenAssignments(driverId, seenAssignments);
    },
    [driverId, getSeenAssignments],
  );

  const loadAssignments = useCallback(async () => {
    if (!enabled || isLoadingRef.current) return;

    isLoadingRef.current = true;
    try {
      const { rides } = await getDriverAssignedRides();
      const seenAssignments = getSeenAssignments();
      const unseenAssignment = rides.find((ride) => !seenAssignments.has(ride.id)) ?? null;

      setAssignedCount(rides.length);
      if (unseenAssignment) {
        setAssignment(unseenAssignment);
        setOpen(true);
        return;
      }

      setAssignment((current) => (current && rides.some((ride) => ride.id === current.id) ? current : null));
    } catch {
      // The assigned page/dashboard already surface fetch errors; this notifier should stay quiet.
    } finally {
      isLoadingRef.current = false;
    }
  }, [enabled, getSeenAssignments]);

  useEffect(() => {
    seenAssignmentsRef.current = null;
  }, [driverId]);

  useEffect(() => {
    void loadAssignments();
  }, [loadAssignments]);

  useBookingRealtime({
    enabled,
    onUpdate: (payload) => {
      if (payload.type === 'ride.updated') {
        void loadAssignments();
      }
    },
  });

  const copy = useMemo(() => (assignment ? getNotificationCopy(assignment) : null), [assignment]);

  if (!assignment || !copy) {
    return null;
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen);
        if (!nextOpen) {
          markSeen(assignment.id);
        }
      }}
    >
      <DialogContent className="w-[calc(100vw-1.5rem)] overflow-hidden rounded-[1.75rem] border-primary/20 p-0 sm:max-w-md">
        <div className="bg-gradient-to-br from-primary/14 via-background to-secondary/10 px-5 pb-5 pt-6">
          <DialogHeader className="text-left">
            <div className="mb-1 flex h-12 w-12 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-[0_18px_35px_-22px_rgba(0,0,0,0.8)]">
              <BellRing className="h-5 w-5" />
            </div>
            <DialogTitle className="text-2xl tracking-tight">{copy.title}</DialogTitle>
            <DialogDescription className="text-sm leading-relaxed">
              {copy.description}
            </DialogDescription>
          </DialogHeader>
        </div>

        <div className="space-y-4 px-5 pb-5">
          <div className="rounded-[1.35rem] border border-border/60 bg-background/78 p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 space-y-1">
                <p className="text-sm font-semibold text-foreground">Assigned route</p>
                <div className="space-y-2 text-sm text-muted-foreground">
                  <div className="flex gap-2">
                    <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                    <span className="line-clamp-2">{assignment.pickupLocation}</span>
                  </div>
                  <div className="flex gap-2">
                    <Navigation className="mt-0.5 h-4 w-4 shrink-0 text-secondary" />
                    <span className="line-clamp-2">{assignment.dropoffLocation}</span>
                  </div>
                </div>
              </div>
              <StatusBadge status={assignment.status} />
            </div>

            <div className="mt-4 grid grid-cols-3 gap-2 text-xs">
              <div className="rounded-[1rem] bg-muted/45 px-3 py-2">
                <p className="text-muted-foreground">Distance</p>
                <p className="mt-1 font-semibold text-foreground">{assignment.distance} km</p>
              </div>
              <div className="rounded-[1rem] bg-muted/45 px-3 py-2">
                <p className="text-muted-foreground">ETA</p>
                <p className="mt-1 inline-flex items-center gap-1 font-semibold text-foreground">
                  <Clock3 className="h-3.5 w-3.5 text-primary" />
                  {assignment.estimatedDuration} min
                </p>
              </div>
              <div className="rounded-[1rem] bg-muted/45 px-3 py-2">
                <p className="text-muted-foreground">Fare</p>
                <p className="mt-1 font-semibold text-foreground">{formatCurrency(assignment.fare)}</p>
              </div>
            </div>
          </div>

          {assignedCount > 1 ? (
            <p className="rounded-[1rem] bg-primary/8 px-3 py-2 text-xs text-muted-foreground">
              You have {assignedCount} assigned rides. Open Assigned after this trip to review the rest.
            </p>
          ) : null}

          <DialogFooter className="gap-2 sm:grid sm:grid-cols-2">
            <DialogClose asChild>
              <Button variant="outline" className="h-11 rounded-full">
                Not now
              </Button>
            </DialogClose>
            <Button asChild className="h-11 rounded-full" onClick={() => markSeen(assignment.id)}>
              <Link href="/driver/active-trip">Open Active</Link>
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}
