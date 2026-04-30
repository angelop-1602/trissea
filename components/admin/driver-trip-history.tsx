'use client';

import type { ReactNode } from 'react';
import { CalendarClock, Clock3, MapPinned, Route } from 'lucide-react';
import { DriverProfileDetailGroup } from '@/components/admin/driver-profile-detail-group';
import { MapView } from '@/components/map-view';
import { StatusBadge } from '@/components/status-badge';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import {
  resolveTripResolutionLabel,
  resolveTripResolutionTimestamp,
  shouldShowTripDriverMarker,
} from '@/lib/dashboard/driver-profile';
import { cn } from '@/lib/utils';

interface DriverTripHistoryRide {
  id: string;
  rideType: string;
  fare: number;
  status: string;
  createdAt: string | Date;
  updatedAt: string | Date;
  startedAt: string | Date | null;
  completedAt: string | Date | null;
  pickupLocation: string;
  dropoffLocation: string;
  pickupLatitude: number;
  pickupLongitude: number;
  dropoffLatitude: number;
  dropoffLongitude: number;
  driverLatitude: number | null;
  driverLongitude: number | null;
  distance: number;
  estimatedDuration: number;
  actualDuration: number | null;
  terminalId: string | null;
  passenger: {
    id: string;
    name: string;
    phone: string | null;
  };
  terminal: {
    id: string;
    name: string;
    location: string;
  } | null;
}

interface DriverTripHistoryProps {
  rides: DriverTripHistoryRide[];
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: 'PHP',
    maximumFractionDigits: 0,
  }).format(value);
}

function formatDateTime(value: string | Date | null) {
  if (!value) return 'Not recorded';
  return new Date(value).toLocaleString();
}

function formatDistance(value: number) {
  return `${value.toFixed(1)} km`;
}

function formatDuration(value: number | null) {
  if (value == null) return 'Not recorded';
  if (value < 60) return `${value} min`;

  const hours = Math.floor(value / 60);
  const minutes = value % 60;
  if (minutes === 0) return `${hours} hr`;
  return `${hours} hr ${minutes} min`;
}

function formatCoordinate(value: number | null) {
  if (value == null || !Number.isFinite(value)) return 'Not recorded';
  return value.toFixed(5);
}

function formatTextLabel(value: string) {
  return value
    .replaceAll('_', ' ')
    .replaceAll('-', ' ')
    .split(' ')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function getHistoryDateLabel(ride: DriverTripHistoryRide) {
  const resolutionLabel = resolveTripResolutionLabel(ride.status);
  return resolutionLabel ? resolutionLabel.replace(' at', '') : 'Requested';
}

function getHistoryDateValue(ride: DriverTripHistoryRide) {
  return (
    resolveTripResolutionTimestamp({
      status: ride.status,
      completedAt: ride.completedAt,
      updatedAt: ride.updatedAt,
    }) ?? ride.createdAt
  );
}

function SummaryFact({
  label,
  value,
  className,
}: {
  label: string;
  value: ReactNode;
  className?: string;
}) {
  return (
    <div className="space-y-1">
      <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">{label}</p>
      <div className={cn('text-sm font-medium leading-relaxed text-foreground break-words', className)}>
        {value}
      </div>
    </div>
  );
}

function RideDetailPanel({ ride }: { ride: DriverTripHistoryRide }) {
  const resolutionLabel = resolveTripResolutionLabel(ride.status);
  const resolutionTimestamp = resolveTripResolutionTimestamp({
    status: ride.status,
    completedAt: ride.completedAt,
    updatedAt: ride.updatedAt,
  });
  const showDriverMarker = shouldShowTripDriverMarker({
    status: ride.status,
    driverLatitude: ride.driverLatitude,
    driverLongitude: ride.driverLongitude,
  });

  return (
    <div className="space-y-6 border-t border-border/60 pt-5">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryFact label="Ride ID" value={<span className="break-all">{ride.id}</span>} />
        <SummaryFact label="Ride Type" value={formatTextLabel(ride.rideType)} />
        <SummaryFact label="Fare" value={formatCurrency(ride.fare)} className="text-primary" />
        <SummaryFact label="Status" value={<StatusBadge status={ride.status} />} />
      </div>

      <div className="space-y-3">
        <div className="flex items-center gap-2 text-sm font-medium text-foreground">
          <MapPinned className="h-4 w-4 text-primary" />
          Trip Map
        </div>
        <MapView
          pickupLocation={ride.pickupLocation}
          dropoffLocation={ride.dropoffLocation}
          pickupLat={ride.pickupLatitude}
          pickupLon={ride.pickupLongitude}
          dropoffLat={ride.dropoffLatitude}
          dropoffLon={ride.dropoffLongitude}
          routeWaypoints={[
            { latitude: ride.pickupLatitude, longitude: ride.pickupLongitude },
            { latitude: ride.dropoffLatitude, longitude: ride.dropoffLongitude },
          ]}
          driverLocation={
            showDriverMarker && ride.driverLatitude != null && ride.driverLongitude != null
              ? {
                  latitude: ride.driverLatitude,
                  longitude: ride.driverLongitude,
                }
              : undefined
          }
          height="h-[320px]"
        />
        <p className="text-xs text-muted-foreground">Route reconstructed from stored trip coordinates.</p>
      </div>

      <div className="grid gap-8 xl:grid-cols-3">
        <DriverProfileDetailGroup
          title="Operational Details"
          items={[
            { label: 'Pickup', value: ride.pickupLocation },
            { label: 'Dropoff', value: ride.dropoffLocation },
            { label: 'Distance', value: formatDistance(ride.distance) },
            { label: 'Estimated Duration', value: formatDuration(ride.estimatedDuration) },
            { label: 'Actual Duration', value: formatDuration(ride.actualDuration) },
            {
              label: 'Terminal',
              value: ride.terminal ? `${ride.terminal.name} - ${ride.terminal.location}` : 'No terminal assigned',
            },
            {
              label: 'Passenger',
              value: ride.passenger.phone ? `${ride.passenger.name} (${ride.passenger.phone})` : ride.passenger.name,
            },
          ]}
        />

        <DriverProfileDetailGroup
          title="Lifecycle"
          items={[
            { label: 'Requested at', value: formatDateTime(ride.createdAt) },
            { label: 'Started at', value: formatDateTime(ride.startedAt) },
            ...(resolutionLabel
              ? [{ label: resolutionLabel, value: formatDateTime(resolutionTimestamp) }]
              : []),
            { label: 'Last updated at', value: formatDateTime(ride.updatedAt) },
          ]}
        />

        <DriverProfileDetailGroup
          title="Geo and Technical"
          items={[
            {
              label: 'Pickup Coordinates',
              value: `${formatCoordinate(ride.pickupLatitude)}, ${formatCoordinate(ride.pickupLongitude)}`,
            },
            {
              label: 'Dropoff Coordinates',
              value: `${formatCoordinate(ride.dropoffLatitude)}, ${formatCoordinate(ride.dropoffLongitude)}`,
            },
            {
              label: 'Terminal Reference',
              value: ride.terminal
                ? `${ride.terminal.name} (${ride.terminal.id})`
                : ride.terminalId ?? 'No terminal reference',
            },
            {
              label: 'Driver Coordinates',
              value: showDriverMarker
                ? `${formatCoordinate(ride.driverLatitude)}, ${formatCoordinate(ride.driverLongitude)}`
                : 'Not shown for inactive trips',
            },
          ]}
        />
      </div>
    </div>
  );
}

export function DriverTripHistory({ rides }: DriverTripHistoryProps) {
  if (rides.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-primary/25 bg-background/20 px-6 py-12 text-center">
        <p className="text-sm font-medium text-foreground">No rides found</p>
        <p className="mt-2 text-sm text-muted-foreground">
          Driver trip history will appear once rides are assigned.
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-border/60 bg-background/20">
      <Accordion type="single" collapsible>
        {rides.map((ride) => (
          <AccordionItem key={ride.id} value={ride.id} className="border-b border-border/60 px-5 last:border-b-0">
            <AccordionTrigger className="gap-6 py-5 hover:no-underline">
              <div className="grid flex-1 gap-3 text-left md:grid-cols-[minmax(0,2.1fr)_minmax(0,1fr)_0.9fr_0.9fr_1.15fr]">
                <div className="space-y-1">
                  <p className="truncate text-sm font-semibold text-foreground">
                    {ride.pickupLocation} to {ride.dropoffLocation}
                  </p>
                  <p className="text-xs text-muted-foreground">Ride ID: {ride.id}</p>
                </div>

                <div className="space-y-1">
                  <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Passenger</p>
                  <p className="truncate text-sm font-medium text-foreground">{ride.passenger.name}</p>
                </div>

                <div className="space-y-1">
                  <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Fare</p>
                  <p className="text-sm font-semibold text-primary">{formatCurrency(ride.fare)}</p>
                </div>

                <div className="space-y-1">
                  <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Status</p>
                  <StatusBadge status={ride.status} />
                </div>

                <div className="space-y-1">
                  <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                    {getHistoryDateLabel(ride)}
                  </p>
                  <p className="text-sm font-medium text-foreground">{formatDateTime(getHistoryDateValue(ride))}</p>
                </div>
              </div>
            </AccordionTrigger>
            <AccordionContent className="pb-5">
              <RideDetailPanel ride={ride} />
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </div>
  );
}
