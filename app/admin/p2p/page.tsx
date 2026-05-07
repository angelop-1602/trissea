'use client';

import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import Link from 'next/link';
import {
  ArrowRightLeft,
  BusFront,
  CalendarClock,
  Clock3,
  MapPinned,
  Plus,
  RefreshCw,
  Route,
  Users,
} from 'lucide-react';
import { AppHeader } from '@/components/app-header';
import { PageHeader } from '@/components/admin/page-header';
import { TableSurface } from '@/components/admin/table-surface';
import { SidebarLayout } from '@/components/sidebar-layout';
import { InlineErrorState, PageLoadingState } from '@/components/page-state';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useBookingRealtime } from '@/hooks/use-booking-realtime';
import { createP2PCorridor, createP2PDeparture, getAdminP2POverview } from '@/lib/p2p/client';
import type { AdminP2POverview } from '@/lib/p2p/types';
import { getAdminSidebarItems } from '@/lib/admin-navigation';
import { useStore } from '@/lib/store-context';
import { cn } from '@/lib/utils';

function formatCurrency(value: number) {
  return new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: 'PHP',
    maximumFractionDigits: 0,
  }).format(value);
}

function formatDepartureTime(value: string) {
  return new Intl.DateTimeFormat('en-PH', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(value));
}

function toDateTimeLocalValue(date = new Date(Date.now() + 60 * 60 * 1000)) {
  const iso = new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString();
  return iso.slice(0, 16);
}

function getStatusTone(status: string) {
  switch (status) {
    case 'boarding':
      return 'border-primary/25 bg-primary/10 text-primary';
    case 'departed':
      return 'border-secondary/25 bg-secondary/10 text-secondary';
    case 'completed':
      return 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700';
    case 'cancelled':
    case 'no_show':
      return 'border-destructive/30 bg-destructive/10 text-destructive';
    default:
      return 'border-border/60 bg-background/70 text-muted-foreground';
  }
}

const initialCorridorForm = {
  code: '',
  name: '',
  summary: '',
  originLabel: '',
  originLatitude: '17.6136',
  originLongitude: '121.7268',
  destinationLabel: '',
  destinationLatitude: '17.6601',
  destinationLongitude: '121.7304',
  distanceKm: '12',
  estimatedDuration: '35',
  baseFare: '120',
};

export default function AdminP2PPage() {
  const { currentUser, currentTenant } = useStore();
  const [data, setData] = useState<AdminP2POverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [creatingCorridor, setCreatingCorridor] = useState(false);
  const [creatingDeparture, setCreatingDeparture] = useState(false);
  const [corridorForm, setCorridorForm] = useState(initialCorridorForm);
  const [selectedCorridorId, setSelectedCorridorId] = useState<string>('');
  const [selectedDriverId, setSelectedDriverId] = useState<string>('');
  const [departureForm, setDepartureForm] = useState({
    vehicleLabel: '',
    boardingBay: 'Bay 01',
    seatCapacity: '18',
    departureTime: toDateTimeLocalValue(),
  });

  const canLoad = currentUser?.role === 'admin';

  const loadOverview = useCallback(async (reason: 'initial' | 'manual' | 'realtime' = 'manual') => {
    if (!canLoad) return;
    if (reason !== 'initial') setIsRefreshing(true);
    try {
      const next = await getAdminP2POverview();
      setData(next);
      if (!selectedCorridorId && next.corridors[0]) {
        setSelectedCorridorId(next.corridors[0].id);
      }
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load P2P admin workspace.');
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }, [canLoad, selectedCorridorId]);

  useEffect(() => {
    void loadOverview('initial');
  }, [loadOverview]);

  useBookingRealtime({
    enabled: Boolean(canLoad),
    onUpdate: (payload) => {
      if (
        payload.type === 'p2p.corridor.updated' ||
        payload.type === 'p2p.departure.updated' ||
        payload.type === 'p2p.reservation.updated'
      ) {
        void loadOverview('realtime');
      }
    },
  });

  const handleCreateCorridor = useCallback(async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setCreatingCorridor(true);
    try {
      await createP2PCorridor({
        code: corridorForm.code,
        name: corridorForm.name,
        summary: corridorForm.summary,
        originLabel: corridorForm.originLabel,
        origin: {
          latitude: Number(corridorForm.originLatitude),
          longitude: Number(corridorForm.originLongitude),
        },
        destinationLabel: corridorForm.destinationLabel,
        destination: {
          latitude: Number(corridorForm.destinationLatitude),
          longitude: Number(corridorForm.destinationLongitude),
        },
        distanceKm: Number(corridorForm.distanceKm),
        estimatedDuration: Number(corridorForm.estimatedDuration),
        baseFare: Number(corridorForm.baseFare),
      });
      setCorridorForm(initialCorridorForm);
      await loadOverview('manual');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create corridor.');
    } finally {
      setCreatingCorridor(false);
    }
  }, [corridorForm, loadOverview]);

  const handleCreateDeparture = useCallback(async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedCorridorId) {
      setError('Choose a corridor before publishing a departure.');
      return;
    }
    setCreatingDeparture(true);
    try {
      await createP2PDeparture({
        corridorId: selectedCorridorId,
        driverId: selectedDriverId || undefined,
        vehicleLabel: departureForm.vehicleLabel,
        boardingBay: departureForm.boardingBay,
        seatCapacity: Number(departureForm.seatCapacity),
        departureTime: new Date(departureForm.departureTime).toISOString(),
      });
      setDepartureForm({
        vehicleLabel: '',
        boardingBay: 'Bay 01',
        seatCapacity: '18',
        departureTime: toDateTimeLocalValue(),
      });
      setSelectedDriverId('');
      await loadOverview('manual');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create departure.');
    } finally {
      setCreatingDeparture(false);
    }
  }, [departureForm, loadOverview, selectedCorridorId, selectedDriverId]);

  const publishedRevenue = useMemo(
    () => data?.activeReservations.reduce((sum, reservation) => sum + reservation.fareTotal, 0) ?? 0,
    [data]
  );

  if (!currentUser || currentUser.role !== 'admin' || loading) {
    return (
      <PageLoadingState
        label="Loading P2P admin workspace..."
        className="min-h-screen bg-background text-foreground"
      />
    );
  }

  return (
    <>
      <AppHeader />
      <div className="mx-auto max-w-7xl px-4 pb-8">
        <SidebarLayout title="Admin Menu" items={getAdminSidebarItems()} activeHref="/admin/p2p">
          <div className="space-y-6">
            <PageHeader
              eyebrow="P2P Module"
              title={`${currentTenant?.name ?? 'Tenant'} point-to-point operations`}
              description="Publish direct corridors, assign drivers, and keep departure manifests visible from one dedicated module instead of mixing the work into TODA reservations."
            />

            <div className="grid gap-4 lg:grid-cols-3">
              <TableSurface title="Corridors" description="Live and prepared direct routes.">
                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="rounded-2xl border border-border/70 bg-background/70 px-4 py-4">
                    <p className="text-[11px] uppercase tracking-[0.15em] text-muted-foreground">Active corridors</p>
                    <p className="mt-2 text-2xl font-semibold text-foreground">{data?.corridors.length ?? 0}</p>
                  </div>
                  <div className="rounded-2xl border border-border/70 bg-background/70 px-4 py-4">
                    <p className="text-[11px] uppercase tracking-[0.15em] text-muted-foreground">Published trips</p>
                    <p className="mt-2 text-2xl font-semibold text-foreground">{data?.departures.length ?? 0}</p>
                  </div>
                  <div className="rounded-2xl border border-border/70 bg-background/70 px-4 py-4">
                    <p className="text-[11px] uppercase tracking-[0.15em] text-muted-foreground">Reserved revenue</p>
                    <p className="mt-2 text-2xl font-semibold text-foreground">{formatCurrency(publishedRevenue)}</p>
                  </div>
                </div>
              </TableSurface>

              <TableSurface title="Workflow" description="Role intent for the completed P2P module.">
                <div className="space-y-3 text-sm text-muted-foreground">
                  <div className="flex items-start gap-3">
                    <Route className="mt-0.5 h-4 w-4 text-primary" />
                    <p>Admins define fixed corridors with direct endpoints and published fares.</p>
                  </div>
                  <div className="flex items-start gap-3">
                    <CalendarClock className="mt-0.5 h-4 w-4 text-primary" />
                    <p>Drivers operate departures through boarding, departure, and completion instead of street-side matching.</p>
                  </div>
                  <div className="flex items-start gap-3">
                    <Users className="mt-0.5 h-4 w-4 text-primary" />
                    <p>Passengers reserve seats and carry a boarding reference all the way to the bay.</p>
                  </div>
                </div>
              </TableSurface>

              <TableSurface
                title="Live sync"
                description="Realtime refresh keeps manifests and departures aligned."
                actions={
                  <Button variant="outline" size="sm" onClick={() => void loadOverview('manual')} disabled={isRefreshing}>
                    <RefreshCw className={cn('h-4 w-4', isRefreshing && 'animate-spin')} />
                    Refresh
                  </Button>
                }
              >
                <div className="space-y-2 text-sm text-muted-foreground">
                  <p>Corridor changes refresh this workspace automatically.</p>
                  <p>Passenger reservations update departure manifests in place.</p>
                  <p>Driver transition events appear here without a manual reload.</p>
                </div>
              </TableSurface>
            </div>

            {error ? <InlineErrorState message={error} onRetry={() => void loadOverview('manual')} /> : null}

            <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
              <TableSurface title="Create corridor" description="Set up a new point-to-point route and publish its baseline fare.">
                <form className="grid gap-4 md:grid-cols-2" onSubmit={handleCreateCorridor}>
                  <div className="space-y-2">
                    <Label htmlFor="p2p-code">Code</Label>
                    <Input id="p2p-code" value={corridorForm.code} onChange={(event) => setCorridorForm((current) => ({ ...current, code: event.target.value }))} placeholder="AIRPORT" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="p2p-name">Route name</Label>
                    <Input id="p2p-name" value={corridorForm.name} onChange={(event) => setCorridorForm((current) => ({ ...current, name: event.target.value }))} placeholder="Downtown to Airport" />
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="p2p-summary">Summary</Label>
                    <Input id="p2p-summary" value={corridorForm.summary} onChange={(event) => setCorridorForm((current) => ({ ...current, summary: event.target.value }))} placeholder="Direct morning and evening shuttle" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="p2p-origin">Origin</Label>
                    <Input id="p2p-origin" value={corridorForm.originLabel} onChange={(event) => setCorridorForm((current) => ({ ...current, originLabel: event.target.value }))} placeholder="SM Center Tuguegarao Downtown" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="p2p-destination">Destination</Label>
                    <Input id="p2p-destination" value={corridorForm.destinationLabel} onChange={(event) => setCorridorForm((current) => ({ ...current, destinationLabel: event.target.value }))} placeholder="Tuguegarao Airport" />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label htmlFor="p2p-origin-lat">Origin lat</Label>
                      <Input id="p2p-origin-lat" type="number" step="0.000001" value={corridorForm.originLatitude} onChange={(event) => setCorridorForm((current) => ({ ...current, originLatitude: event.target.value }))} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="p2p-origin-lng">Origin lng</Label>
                      <Input id="p2p-origin-lng" type="number" step="0.000001" value={corridorForm.originLongitude} onChange={(event) => setCorridorForm((current) => ({ ...current, originLongitude: event.target.value }))} />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label htmlFor="p2p-destination-lat">Destination lat</Label>
                      <Input id="p2p-destination-lat" type="number" step="0.000001" value={corridorForm.destinationLatitude} onChange={(event) => setCorridorForm((current) => ({ ...current, destinationLatitude: event.target.value }))} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="p2p-destination-lng">Destination lng</Label>
                      <Input id="p2p-destination-lng" type="number" step="0.000001" value={corridorForm.destinationLongitude} onChange={(event) => setCorridorForm((current) => ({ ...current, destinationLongitude: event.target.value }))} />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="p2p-distance">Distance (km)</Label>
                    <Input id="p2p-distance" type="number" step="0.1" value={corridorForm.distanceKm} onChange={(event) => setCorridorForm((current) => ({ ...current, distanceKm: event.target.value }))} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="p2p-duration">Travel mins</Label>
                    <Input id="p2p-duration" type="number" step="1" value={corridorForm.estimatedDuration} onChange={(event) => setCorridorForm((current) => ({ ...current, estimatedDuration: event.target.value }))} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="p2p-fare">Base fare</Label>
                    <Input id="p2p-fare" type="number" step="1" value={corridorForm.baseFare} onChange={(event) => setCorridorForm((current) => ({ ...current, baseFare: event.target.value }))} />
                  </div>
                  <div className="md:col-span-2">
                    <Button type="submit" className="h-11 rounded-full" disabled={creatingCorridor}>
                      <Plus className="mr-2 h-4 w-4" />
                      {creatingCorridor ? 'Creating corridor...' : 'Create corridor'}
                    </Button>
                  </div>
                </form>
              </TableSurface>

              <TableSurface title="Publish departure" description="Schedule a specific trip, assign a driver, and open its seat inventory.">
                <form className="grid gap-4" onSubmit={handleCreateDeparture}>
                  <div className="space-y-2">
                    <Label>Corridor</Label>
                    <Select value={selectedCorridorId} onValueChange={setSelectedCorridorId}>
                      <SelectTrigger className="h-11 rounded-[1rem]">
                        <SelectValue placeholder="Choose a corridor" />
                      </SelectTrigger>
                      <SelectContent>
                        {data?.corridors.map((corridor) => (
                          <SelectItem key={corridor.id} value={corridor.id}>
                            {corridor.code} • {corridor.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Driver</Label>
                    <Select value={selectedDriverId || '__unassigned__'} onValueChange={(value) => setSelectedDriverId(value === '__unassigned__' ? '' : value)}>
                      <SelectTrigger className="h-11 rounded-[1rem]">
                        <SelectValue placeholder="Optional driver assignment" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__unassigned__">Unassigned</SelectItem>
                        {data?.drivers.map((driver) => (
                          <SelectItem key={driver.id} value={driver.id}>
                            {driver.name}{driver.todaName ? ` • ${driver.todaName}` : ''}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="p2p-vehicle">Vehicle label</Label>
                      <Input id="p2p-vehicle" value={departureForm.vehicleLabel} onChange={(event) => setDepartureForm((current) => ({ ...current, vehicleLabel: event.target.value }))} placeholder="Blue Airport Shuttle" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="p2p-bay">Boarding bay</Label>
                      <Input id="p2p-bay" value={departureForm.boardingBay} onChange={(event) => setDepartureForm((current) => ({ ...current, boardingBay: event.target.value }))} />
                    </div>
                  </div>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="p2p-capacity">Seat capacity</Label>
                      <Input id="p2p-capacity" type="number" value={departureForm.seatCapacity} onChange={(event) => setDepartureForm((current) => ({ ...current, seatCapacity: event.target.value }))} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="p2p-departure-time">Departure time</Label>
                      <Input id="p2p-departure-time" type="datetime-local" value={departureForm.departureTime} onChange={(event) => setDepartureForm((current) => ({ ...current, departureTime: event.target.value }))} />
                    </div>
                  </div>
                  <Button type="submit" className="h-11 rounded-full" disabled={creatingDeparture}>
                    <CalendarClock className="mr-2 h-4 w-4" />
                    {creatingDeparture ? 'Publishing departure...' : 'Publish departure'}
                  </Button>
                </form>
              </TableSurface>
            </div>

            <TableSurface title="Corridor board" description="Published routes and their next departures.">
              <div className="grid gap-3 lg:grid-cols-2">
                {data?.corridors.length ? (
                  data.corridors.map((corridor) => (
                    <div key={corridor.id} className="rounded-[1.5rem] border border-border/60 bg-background/70 px-4 py-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="inline-flex items-center gap-2 rounded-full border border-primary/15 bg-primary/8 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-primary">
                            <Route className="h-3.5 w-3.5" />
                            {corridor.code}
                          </div>
                          <p className="mt-3 text-base font-semibold text-foreground">{corridor.name}</p>
                          <p className="text-sm text-muted-foreground">
                            {corridor.originLabel} to {corridor.destinationLabel}
                          </p>
                        </div>
                        <div className="rounded-[1rem] border border-border/45 bg-card px-3 py-2 text-right">
                          <p className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">Fare</p>
                          <p className="mt-1 text-sm font-semibold text-foreground">{formatCurrency(corridor.baseFare)}</p>
                        </div>
                      </div>
                      {corridor.nextDeparture ? (
                        <div className="mt-4 rounded-[1.2rem] border border-primary/15 bg-primary/[0.05] px-3.5 py-3 text-sm text-muted-foreground">
                          Next trip: {formatDepartureTime(corridor.nextDeparture.departureTime)} • Bay {corridor.nextDeparture.boardingBay} • {corridor.nextDeparture.availableSeats}/{corridor.nextDeparture.seatCapacity} seats open
                        </div>
                      ) : (
                        <div className="mt-4 rounded-[1.2rem] border border-dashed border-border/70 bg-card/50 px-3.5 py-3 text-sm text-muted-foreground">
                          No departure published yet for this corridor.
                        </div>
                      )}
                    </div>
                  ))
                ) : (
                  <div className="rounded-[1.6rem] border border-dashed border-border/70 bg-background/60 px-4 py-8 text-center text-sm text-muted-foreground">
                    Create the first P2P corridor to unlock departure publishing.
                  </div>
                )}
              </div>
            </TableSurface>

            <TableSurface title="Departure board" description="Upcoming and recently active departures with seat status.">
              <div className="space-y-3">
                {data?.departures.length ? (
                  data.departures.map((departure) => (
                    <div key={departure.id} className="rounded-[1.55rem] border border-border/60 bg-background/70 px-4 py-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="space-y-1">
                          <p className="text-base font-semibold text-foreground">{departure.corridorName}</p>
                          <p className="text-sm text-muted-foreground">
                            {formatDepartureTime(departure.departureTime)} • Bay {departure.boardingBay}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {departure.driver?.name ?? 'No driver assigned'}{departure.vehicleLabel ? ` • ${departure.vehicleLabel}` : ''}
                          </p>
                        </div>
                        <span className={cn('inline-flex rounded-full border px-3 py-1 text-[11px] font-medium', getStatusTone(departure.status))}>
                          {departure.status}
                        </span>
                      </div>
                      <div className="mt-3 grid gap-2 md:grid-cols-4">
                        <div className="rounded-xl border border-border/45 bg-card px-3 py-2 text-sm">Seats: {departure.availableSeats}/{departure.seatCapacity}</div>
                        <div className="rounded-xl border border-border/45 bg-card px-3 py-2 text-sm">Fare: {formatCurrency(departure.baseFare)}</div>
                        <div className="rounded-xl border border-border/45 bg-card px-3 py-2 text-sm">Bookings: {departure.reservations.length}</div>
                        <div className="rounded-xl border border-border/45 bg-card px-3 py-2 text-sm">Boarded: {departure.reservations.filter((reservation) => reservation.status === 'boarded').length}</div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="rounded-[1.6rem] border border-dashed border-border/70 bg-background/60 px-4 py-8 text-center text-sm text-muted-foreground">
                    Published departures will appear here after you schedule them.
                  </div>
                )}
              </div>
            </TableSurface>

            <TableSurface title="Active reservations" description="The live passenger list across current P2P departures.">
              <div className="space-y-3">
                {data?.activeReservations.length ? (
                  data.activeReservations.map((reservation) => (
                    <div key={reservation.id} className="rounded-[1.45rem] border border-border/60 bg-background/70 px-4 py-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="space-y-1">
                          <p className="text-sm font-semibold text-foreground">{reservation.passenger?.name ?? 'Passenger'}</p>
                          <p className="text-sm text-muted-foreground">
                            {reservation.departure.corridorName} • {reservation.bookingReference}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {formatDepartureTime(reservation.departure.departureTime)} • Bay {reservation.departure.boardingBay}
                          </p>
                        </div>
                        <span className={cn('inline-flex rounded-full border px-3 py-1 text-[11px] font-medium', getStatusTone(reservation.status))}>
                          {reservation.status}
                        </span>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="rounded-[1.6rem] border border-dashed border-border/70 bg-background/60 px-4 py-8 text-center text-sm text-muted-foreground">
                    Reservations will appear here after passengers book published departures.
                  </div>
                )}
              </div>
            </TableSurface>

            <div className="flex flex-wrap gap-2">
              <Link href="/admin/modules">
                <Button variant="outline">Back to Modules</Button>
              </Link>
              <Link href="/admin/tricycle">
                <Button>
                  <MapPinned className="mr-2 h-4 w-4" />
                  Open Tricycle
                </Button>
              </Link>
            </div>
          </div>
        </SidebarLayout>
      </div>
    </>
  );
}
