'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import type { FormEvent } from 'react';
import type { MapMouseEvent } from 'maplibre-gl';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CartesianGrid, Line, LineChart, XAxis, YAxis } from 'recharts';
import { BarChart3, Clock, DollarSign, MapPin, Pencil, Settings, TrendingUp, Users } from 'lucide-react';
import { AppHeader } from '@/components/app-header';
import { PageHeader } from '@/components/admin/page-header';
import { AdminSubnavRail } from '@/components/admin/subnav-rail';
import { SummaryStrip } from '@/components/admin/summary-strip';
import { TableSurface } from '@/components/admin/table-surface';
import { ListCardSkeleton, MapCardSkeleton, PageHeaderSkeleton, StatsCardsSkeleton } from '@/components/dashboard/loading-skeletons';
import { MapView, type MapPoint } from '@/components/map-view';
import { InlineErrorState } from '@/components/page-state';
import { SidebarLayout } from '@/components/sidebar-layout';
import { StatusBadge } from '@/components/status-badge';
import { Map, MapControls, MapMarker, MarkerContent, MarkerTooltip, useMap } from '@/components/ui/map';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from '@/components/ui/chart';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PendingButtonContent } from '@/components/ui/pending-button-content';
import { Switch } from '@/components/ui/switch';
import { useBookingRealtime } from '@/hooks/use-booking-realtime';
import { getAdminTerminalDetails, type AdminTerminalDetailsData, updateAdminTerminal } from '@/lib/dashboard/client';
import { getAdminSidebarItems } from '@/lib/admin-navigation';
import { useStore } from '@/lib/store-context';

function formatCurrency(value: number) {
  return new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: 'PHP',
    maximumFractionDigits: 0,
  }).format(value);
}

function formatShortDate(value: string) {
  return value.slice(5).replace('-', '/');
}

const VOLUME_CHART_CONFIG = {
  requests: { label: 'Requests', color: 'var(--chart-1)' },
  completed: { label: 'Completed', color: 'var(--chart-2)' },
  cancelled: { label: 'Cancelled', color: 'var(--destructive)' },
  reservations: { label: 'Reservations', color: 'var(--chart-4)' },
} satisfies ChartConfig;

const REVENUE_CHART_CONFIG = {
  revenue: { label: 'Revenue', color: 'var(--chart-5)' },
} satisfies ChartConfig;

type Coordinates = {
  latitude: number;
  longitude: number;
};

type TerminalOperationsPanel = 'queued' | 'in-progress' | 'reservations';

const DEFAULT_MAP_CENTER: [number, number] = [121.0244, 14.5547];

function TerminalDot({ tone = 'existing' }: { tone?: 'existing' | 'candidate' }) {
  return (
    <div
      className={`h-3.5 w-3.5 rounded-full border-2 border-background shadow-md ring-2 ring-border/70 ${
        tone === 'candidate' ? 'bg-primary' : 'bg-secondary'
      }`}
    />
  );
}

function FocusTerminalMap({ coordinates }: { coordinates: Coordinates | null }) {
  const { map, isLoaded } = useMap();

  useEffect(() => {
    if (!map || !isLoaded || !coordinates) return;

    map.easeTo({
      center: [coordinates.longitude, coordinates.latitude],
      zoom: Math.max(13, map.getZoom()),
      duration: 500,
    });
  }, [map, isLoaded, coordinates]);

  return null;
}

function TerminalMapEditCapture({
  enabled,
  onEnable,
  onPick,
}: {
  enabled: boolean;
  onEnable: () => void;
  onPick: (coordinates: Coordinates) => void;
}) {
  const { map, isLoaded } = useMap();

  useEffect(() => {
    if (!map || !isLoaded) return;

    const canvas = map.getCanvas();
    canvas.style.cursor = enabled ? 'crosshair' : '';

    const wasDoubleClickZoomEnabled = map.doubleClickZoom.isEnabled();
    map.doubleClickZoom.disable();

    const handleClick = (event: MapMouseEvent) => {
      if (!enabled) return;
      onPick({
        latitude: event.lngLat.lat,
        longitude: event.lngLat.lng,
      });
    };

    const handleDoubleClick = (event: MapMouseEvent) => {
      event.preventDefault();
      if (!enabled) {
        onEnable();
      } else {
        onPick({
          latitude: event.lngLat.lat,
          longitude: event.lngLat.lng,
        });
      }
    };

    map.on('click', handleClick);
    map.on('dblclick', handleDoubleClick);

    return () => {
      map.off('click', handleClick);
      map.off('dblclick', handleDoubleClick);
      canvas.style.cursor = '';
      if (wasDoubleClickZoomEnabled) {
        map.doubleClickZoom.enable();
      }
    };
  }, [enabled, isLoaded, map, onEnable, onPick]);

  return null;
}

export default function AdminTerminalDetailsPage() {
  const params = useParams<{ terminalId: string }>();
  const terminalIdParam = params?.terminalId;
  const terminalId = Array.isArray(terminalIdParam) ? terminalIdParam[0] : terminalIdParam ?? '';

  const { currentUser, currentTenant } = useStore();
  const [data, setData] = useState<AdminTerminalDetailsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [mapEditEnabled, setMapEditEnabled] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);
  const [terminalName, setTerminalName] = useState('');
  const [terminalLocation, setTerminalLocation] = useState('');
  const [terminalCapacity, setTerminalCapacity] = useState('');
  const [selectedCoordinates, setSelectedCoordinates] = useState<Coordinates | null>(null);
  const [activeOperationsPanel, setActiveOperationsPanel] = useState<TerminalOperationsPanel>('queued');
  const loadingRef = useRef(false);

  const canLoad = currentUser?.role === 'admin' && Boolean(currentTenant) && Boolean(terminalId);

  const loadData = useCallback(
    async (options?: { syncForm?: boolean }) => {
      if (!canLoad || loadingRef.current) return;
      loadingRef.current = true;

      try {
        const response = await getAdminTerminalDetails(terminalId);
        setData(response);
        setError(null);

        if (options?.syncForm ?? true) {
          setTerminalName(response.terminal.name);
          setTerminalLocation(response.terminal.location);
          setTerminalCapacity(String(response.terminal.capacity));
          setSelectedCoordinates({
            latitude: response.terminal.latitude,
            longitude: response.terminal.longitude,
          });
          setMapEditEnabled(false);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load terminal details.');
      } finally {
        loadingRef.current = false;
        setLoading(false);
      }
    },
    [canLoad, terminalId]
  );

  useEffect(() => {
    void loadData({ syncForm: true });
  }, [loadData]);

  useEffect(() => {
    if (!canLoad) return;

    const interval = setInterval(() => {
      void loadData({ syncForm: false });
    }, 30_000);

    return () => clearInterval(interval);
  }, [canLoad, loadData]);

  useBookingRealtime({
    enabled: Boolean(canLoad),
    onUpdate: (payload) => {
      if (payload.type === 'ride.updated' || payload.type === 'reservation.updated' || payload.type === 'terminal.updated') {
        void loadData({ syncForm: false });
      }
    },
  });

  const sidebarItems = getAdminSidebarItems();

  const terminal = data?.terminal ?? null;
  const stats = data?.stats ?? null;
  const queuedRides = data?.activeRides.filter((ride) => ride.status === 'searching') ?? [];
  const inProgressRides =
    data?.activeRides.filter((ride) => ['matched', 'en_route', 'arrived', 'in_trip'].includes(ride.status)) ?? [];
  const analyticsChartData = (data?.analytics ?? []).map((point) => ({
    ...point,
    dateLabel: formatShortDate(point.date),
  }));

  const parsedCapacity = Number(terminalCapacity);
  const isCapacityValid = Number.isInteger(parsedCapacity) && parsedCapacity >= 1 && parsedCapacity <= 500;

  const hasUnsavedChanges = terminal
    ? terminalName.trim() !== terminal.name ||
      terminalLocation.trim() !== terminal.location ||
      (isCapacityValid ? parsedCapacity !== terminal.capacity : terminalCapacity.trim() !== String(terminal.capacity)) ||
      (selectedCoordinates
        ? selectedCoordinates.latitude !== terminal.latitude || selectedCoordinates.longitude !== terminal.longitude
        : false)
    : false;

  const handleResetForm = useCallback(() => {
    if (!terminal) return;
    setTerminalName(terminal.name);
    setTerminalLocation(terminal.location);
    setTerminalCapacity(String(terminal.capacity));
    setSelectedCoordinates({
      latitude: terminal.latitude,
      longitude: terminal.longitude,
    });
    setMapEditEnabled(false);
    setSaveError(null);
    setSaveSuccess(null);
  }, [terminal]);

  const handleSave = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (!canLoad || saving || !terminal) return;

      const name = terminalName.trim();
      const location = terminalLocation.trim();
      const capacity = Number(terminalCapacity);
      if (!selectedCoordinates) {
        setSaveError('Select terminal coordinates on the map.');
        setSaveSuccess(null);
        return;
      }

      if (name.length < 2 || location.length < 2) {
        setSaveError('Terminal name and location must be at least 2 characters.');
        setSaveSuccess(null);
        return;
      }

      if (!Number.isInteger(capacity) || capacity < 1 || capacity > 500) {
        setSaveError('Capacity must be a whole number between 1 and 500.');
        setSaveSuccess(null);
        return;
      }

      if (capacity < terminal.currentQueued) {
        setSaveError(`Capacity cannot be lower than current queued count (${terminal.currentQueued}).`);
        setSaveSuccess(null);
        return;
      }

      const payload: {
        name?: string;
        location?: string;
        capacity?: number;
        latitude?: number;
        longitude?: number;
      } = {};

      if (name !== terminal.name) payload.name = name;
      if (location !== terminal.location) payload.location = location;
      if (capacity !== terminal.capacity) payload.capacity = capacity;
      if (selectedCoordinates.latitude !== terminal.latitude || selectedCoordinates.longitude !== terminal.longitude) {
        payload.latitude = selectedCoordinates.latitude;
        payload.longitude = selectedCoordinates.longitude;
      }

      if (Object.keys(payload).length === 0) {
        setSaveSuccess('No changes to save.');
        setSaveError(null);
        return;
      }

      setSaving(true);
      setSaveError(null);
      setSaveSuccess(null);

      try {
        await updateAdminTerminal(terminal.id, payload);
        await loadData({ syncForm: true });
        setSaveSuccess('Terminal details updated.');
        setIsEditDialogOpen(false);
      } catch (err) {
        setSaveError(err instanceof Error ? err.message : 'Failed to update terminal.');
      } finally {
        setSaving(false);
      }
    },
    [canLoad, loadData, saving, selectedCoordinates, terminal, terminalCapacity, terminalLocation, terminalName]
  );

  const terminalPoint = useMemo<MapPoint[]>(
    () =>
      terminal
        ? [
            {
              id: terminal.id,
              label: terminal.name,
              description: `${terminal.location} | Queue ${terminal.currentQueued}/${terminal.capacity}`,
              latitude: terminal.latitude,
              longitude: terminal.longitude,
              tone: 'terminal',
            },
          ]
        : [],
    [terminal]
  );

  const handlePickCoordinates = useCallback((coordinates: Coordinates) => {
    setSelectedCoordinates(coordinates);
    setSaveError(null);
    setSaveSuccess(null);
  }, []);

  const focusCoordinates: Coordinates | null = selectedCoordinates
    ? selectedCoordinates
    : terminal
      ? {
          latitude: terminal.latitude,
          longitude: terminal.longitude,
        }
      : null;
  const operationPanels = [
    {
      key: 'queued' as const,
      label: 'Queued',
      description: 'Search requests still waiting in the on-demand queue before driver assignment.',
      badge: queuedRides.length,
    },
    {
      key: 'in-progress' as const,
      label: 'In Progress',
      description: 'Matched and moving trips that are already being handled around this terminal.',
      badge: inProgressRides.length,
    },
    {
      key: 'reservations' as const,
      label: 'Reservations',
      description: 'Live terminal reservations still active in the boarding queue.',
      badge: data?.activeReservations.length ?? 0,
    },
  ];
  const activeOperationsPanelConfig =
    operationPanels.find((panel) => panel.key === activeOperationsPanel) ?? operationPanels[0];

  if (!currentUser || currentUser.role !== 'admin' || !currentTenant) {
    return (
      <div className="space-y-6 p-6">
        <PageHeaderSkeleton withAction />
        <StatsCardsSkeleton count={6} className="md:grid-cols-2 lg:grid-cols-6" />
        <div className="grid gap-4 lg:grid-cols-3">
          <MapCardSkeleton className="lg:col-span-2" />
          <ListCardSkeleton itemCount={2} />
        </div>
      </div>
    );
  }

  if (!terminalId || (!terminal && error)) {
    return (
      <>
        <AppHeader />
        <div className="mx-auto max-w-7xl px-4 pb-8">
          <SidebarLayout title="Admin Menu" items={sidebarItems}>
            <InlineErrorState message={error ?? 'Terminal not found.'} onRetry={() => void loadData({ syncForm: false })} />
          </SidebarLayout>
        </div>
      </>
    );
  }

  if (loading || !terminal || !data || !stats) {
    return (
      <>
        <AppHeader />
        <div className="mx-auto max-w-7xl px-4 pb-8">
          <SidebarLayout title="Admin Menu" items={sidebarItems}>
            <div className="space-y-6">
              <PageHeaderSkeleton withAction />
              <StatsCardsSkeleton count={6} className="md:grid-cols-2 lg:grid-cols-6" />
              <div className="grid gap-4 lg:grid-cols-3">
                <MapCardSkeleton className="lg:col-span-2" heightClassName="h-[360px]" />
                <ListCardSkeleton itemCount={2} />
              </div>
              <ListCardSkeleton itemCount={3} />
              <ListCardSkeleton itemCount={3} />
            </div>
          </SidebarLayout>
        </div>
      </>
    );
  }

  return (
    <>
      <AppHeader />
      <div className="mx-auto max-w-7xl px-4 pb-8">
        <SidebarLayout title="Admin Menu" items={sidebarItems}>
          <div className="space-y-6">
            <PageHeader
              eyebrow="Terminal Detail"
              title={terminal.name}
              description={terminal.location}
              actions={
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    handleResetForm();
                    setIsEditDialogOpen(true);
                  }}
                >
                  <Pencil className="h-4 w-4" />
                  Edit Terminal
                </Button>
              }
            />

            {error ? <InlineErrorState message={error} onRetry={() => void loadData({ syncForm: false })} /> : null}

            <SummaryStrip
              items={[
                { label: 'Current Queue', value: stats.currentQueued },
                { label: 'Capacity', value: stats.capacity },
                { label: 'Occupancy', value: `${stats.occupancyPercent.toFixed(1)}%` },
                { label: 'Active On-Demand', value: stats.activeOnDemandTotal },
                { label: 'Active Reservations', value: stats.activeReservationsTotal },
                {
                  label: 'Today Revenue',
                  value: formatCurrency(stats.today.revenue),
                  meta: `${stats.today.requests} requests today`,
                  emphasized: true,
                },
              ]}
              className="md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6"
            />

            <div className="grid gap-4 lg:grid-cols-3">
              <TableSurface
                title="Terminal Location"
                description="Map view of this TODA terminal."
                className="lg:col-span-2"
              >
                <MapView points={terminalPoint} showRoute={false} height="h-[360px]" />
              </TableSurface>

              <TableSurface
                title="Quick Edit"
                description="Editing is available from the header action."
              >
                <div className="min-h-[220px]" />
              </TableSurface>
            </div>

            <TableSurface
              title="Terminal Operations"
              description="Active queue and reservation activity."
              bodyClassName="pt-0"
            >
              <div className="-mx-5 -my-4 grid gap-0 lg:grid-cols-[240px_minmax(0,1fr)]">
                <aside className="border-b border-border/60 bg-background/18 px-5 py-5 lg:border-b-0 lg:border-r">
                  <AdminSubnavRail
                    title="Live Queues"
                    items={operationPanels.map((panel) => ({
                      key: panel.key,
                      label: panel.label,
                      description: panel.description,
                      badge: panel.badge,
                      active: panel.key === activeOperationsPanel,
                      onClick: () => setActiveOperationsPanel(panel.key),
                    }))}
                  />
                </aside>

                <div className="px-5 py-5">
                  <div className="mb-5 space-y-1">
                    <h3 className="text-lg font-semibold text-foreground">
                      {activeOperationsPanelConfig.label}
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      {activeOperationsPanelConfig.description}
                    </p>
                  </div>

                  {activeOperationsPanel === 'queued' ? (
                    queuedRides.length === 0 ? (
                      <p className="text-sm text-muted-foreground">No queued on-demand requests.</p>
                    ) : (
                      <div className="space-y-2">
                        {queuedRides.map((ride, index) => (
                          <Card key={ride.id}>
                            <CardContent className="pt-4">
                              <div className="flex flex-wrap items-start justify-between gap-3">
                                <div>
                                  <p className="text-sm font-medium">{ride.passenger.name}</p>
                                  <p className="text-xs text-muted-foreground">{ride.passenger.phone ?? 'No phone'}</p>
                                  <p className="text-xs text-muted-foreground">
                                    {ride.pickupLocation} to {ride.dropoffLocation}
                                  </p>
                                  <p className="text-xs text-muted-foreground">Queue #{index + 1}</p>
                                </div>
                                <StatusBadge status={ride.status} />
                              </div>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    )
                  ) : null}

                  {activeOperationsPanel === 'in-progress' ? (
                    inProgressRides.length === 0 ? (
                      <p className="text-sm text-muted-foreground">No in-progress on-demand requests.</p>
                    ) : (
                      <div className="space-y-2">
                        {inProgressRides.map((ride) => (
                          <Card key={ride.id}>
                            <CardContent className="pt-4">
                              <div className="flex flex-wrap items-start justify-between gap-3">
                                <div>
                                  <p className="text-sm font-medium">{ride.passenger.name}</p>
                                  <p className="text-xs text-muted-foreground">{ride.passenger.phone ?? 'No phone'}</p>
                                  <p className="text-xs text-muted-foreground">
                                    {ride.pickupLocation} to {ride.dropoffLocation}
                                  </p>
                                  <p className="text-xs text-muted-foreground">
                                    Driver: {ride.driver?.name ?? 'Not assigned yet'}
                                  </p>
                                </div>
                                <StatusBadge status={ride.status} />
                              </div>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    )
                  ) : null}

                  {activeOperationsPanel === 'reservations' ? (
                    data.activeReservations.length === 0 ? (
                      <p className="text-sm text-muted-foreground">No active reservations for this terminal.</p>
                    ) : (
                      <div className="space-y-2">
                        {data.activeReservations.map((reservation) => (
                          <Card key={reservation.id}>
                            <CardContent className="pt-4">
                              <div className="flex flex-wrap items-start justify-between gap-3">
                                <div>
                                  <p className="text-sm font-medium">{reservation.passenger.name}</p>
                                  <p className="text-xs text-muted-foreground">{reservation.passenger.phone ?? 'No phone'}</p>
                                  <p className="text-xs text-muted-foreground">Queue #{reservation.queuePosition}</p>
                                  <p className="text-xs text-muted-foreground">
                                    Boarding: {new Date(reservation.boardingTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                  </p>
                                </div>
                                <StatusBadge status={reservation.status} />
                              </div>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    )
                  ) : null}
                </div>
              </div>
            </TableSurface>

            <TableSurface
              title="30-Day Terminal Analytics"
              description="Operations mix, conversion, and revenue trends."
            >
              <div className="space-y-6">
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
                  <Card>
                    <CardContent className="pt-6">
                      <p className="text-xs text-muted-foreground">Total Requests</p>
                      <p className="mt-1 text-2xl font-bold">{stats.totals30d.requests}</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-6">
                      <p className="text-xs text-muted-foreground">Completion Rate</p>
                      <p className="mt-1 text-2xl font-bold">{stats.totals30d.completionRate.toFixed(1)}%</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-6">
                      <p className="text-xs text-muted-foreground">Cancellation Rate</p>
                      <p className="mt-1 text-2xl font-bold">{stats.totals30d.cancellationRate.toFixed(1)}%</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-6">
                      <p className="text-xs text-muted-foreground">Total Revenue</p>
                      <p className="mt-1 text-2xl font-bold">{formatCurrency(stats.totals30d.revenue)}</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-6">
                      <p className="text-xs text-muted-foreground">Average Fare</p>
                      <p className="mt-1 text-2xl font-bold">{formatCurrency(stats.totals30d.averageFare)}</p>
                    </CardContent>
                  </Card>
                </div>

                <div className="grid gap-4 xl:grid-cols-2">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Daily Volume</CardTitle>
                      <CardDescription>Requests, completions, cancellations, and reservations.</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <ChartContainer config={VOLUME_CHART_CONFIG} className="h-[280px] w-full">
                        <LineChart data={analyticsChartData} margin={{ left: 10, right: 10, top: 10 }}>
                          <CartesianGrid vertical={false} />
                          <XAxis
                            dataKey="dateLabel"
                            tickLine={false}
                            axisLine={false}
                            minTickGap={16}
                          />
                          <YAxis allowDecimals={false} width={34} />
                          <ChartTooltip content={<ChartTooltipContent />} />
                          <Line type="monotone" dataKey="requests" stroke="var(--color-requests)" strokeWidth={2} dot={false} />
                          <Line type="monotone" dataKey="completed" stroke="var(--color-completed)" strokeWidth={2} dot={false} />
                          <Line type="monotone" dataKey="cancelled" stroke="var(--color-cancelled)" strokeWidth={2} dot={false} />
                          <Line type="monotone" dataKey="reservations" stroke="var(--color-reservations)" strokeWidth={2} dot={false} />
                        </LineChart>
                      </ChartContainer>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Daily Revenue</CardTitle>
                      <CardDescription>Completed-ride fare totals per day.</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <ChartContainer config={REVENUE_CHART_CONFIG} className="h-[280px] w-full">
                        <LineChart data={analyticsChartData} margin={{ left: 10, right: 10, top: 10 }}>
                          <CartesianGrid vertical={false} />
                          <XAxis
                            dataKey="dateLabel"
                            tickLine={false}
                            axisLine={false}
                            minTickGap={16}
                          />
                          <YAxis
                            width={56}
                            tickFormatter={(value) =>
                              new Intl.NumberFormat('en-PH', {
                                notation: 'compact',
                                maximumFractionDigits: 1,
                              }).format(value)
                            }
                          />
                          <ChartTooltip
                            content={
                              <ChartTooltipContent
                                formatter={(value) => [formatCurrency(Number(value)), 'Revenue']}
                              />
                            }
                          />
                          <Line type="monotone" dataKey="revenue" stroke="var(--color-revenue)" strokeWidth={2.5} dot={false} />
                        </LineChart>
                      </ChartContainer>
                    </CardContent>
                  </Card>
                </div>
              </div>
            </TableSurface>
          </div>
        </SidebarLayout>
      </div>

      <Dialog
        open={isEditDialogOpen}
        onOpenChange={(open) => {
          setIsEditDialogOpen(open);
          if (!open) {
            setMapEditEnabled(false);
            setSaveError(null);
            setSaveSuccess(null);
          }
        }}
      >
        <DialogContent className="w-[96vw] sm:max-w-6xl xl:max-w-7xl max-h-[94vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Terminal</DialogTitle>
            <DialogDescription>
              Update terminal details and map coordinates. Enable map editing first to avoid accidental clicks.
            </DialogDescription>
          </DialogHeader>

          <form className="space-y-4" onSubmit={handleSave}>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="edit-terminal-name">Terminal name</Label>
                <Input
                  id="edit-terminal-name"
                  value={terminalName}
                  onChange={(event) => {
                    setTerminalName(event.target.value);
                    setSaveError(null);
                    setSaveSuccess(null);
                  }}
                  maxLength={120}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-terminal-location">Location label</Label>
                <Input
                  id="edit-terminal-location"
                  value={terminalLocation}
                  onChange={(event) => {
                    setTerminalLocation(event.target.value);
                    setSaveError(null);
                    setSaveSuccess(null);
                  }}
                  maxLength={200}
                />
              </div>
            </div>

            <div className="space-y-2 md:max-w-sm">
              <Label htmlFor="edit-terminal-capacity">Capacity</Label>
              <Input
                id="edit-terminal-capacity"
                type="number"
                min={1}
                max={500}
                step={1}
                value={terminalCapacity}
                onChange={(event) => {
                  setTerminalCapacity(event.target.value);
                  setSaveError(null);
                  setSaveSuccess(null);
                }}
              />
              <p className="text-xs text-muted-foreground">
                Capacity cannot be lower than current queued ({terminal.currentQueued}).
              </p>
            </div>

            <div className="rounded-lg border border-border bg-muted/50 p-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium">Enable map editing</p>
                  <p className="text-xs text-muted-foreground">Use toggle or double-click the map to unlock map editing.</p>
                </div>
                <Switch
                  aria-label="Enable map editing"
                  checked={mapEditEnabled}
                  onCheckedChange={(checked) => setMapEditEnabled(Boolean(checked))}
                  className="h-6 w-11 border-border data-[state=unchecked]:bg-muted data-[state=checked]:bg-brand [&_[data-slot=switch-thumb]]:bg-background"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Terminal location on map</Label>
              <div className="h-[42vh] min-h-[320px] max-h-[620px] overflow-hidden rounded-lg border border-border">
                <Map
                  center={focusCoordinates ? [focusCoordinates.longitude, focusCoordinates.latitude] : DEFAULT_MAP_CENTER}
                  zoom={focusCoordinates ? 13 : 6}
                  attributionControl={false}
                  className="h-full w-full"
                  cooperativeGestures
                >
                  <MapControls position="bottom-right" showZoom showLocate showFullscreen />
                  <TerminalMapEditCapture
                    enabled={mapEditEnabled}
                    onEnable={() => setMapEditEnabled(true)}
                    onPick={handlePickCoordinates}
                  />
                  <FocusTerminalMap coordinates={focusCoordinates} />

                  <MapMarker longitude={terminal.longitude} latitude={terminal.latitude}>
                    <MarkerContent>
                      <TerminalDot tone="existing" />
                    </MarkerContent>
                    <MarkerTooltip>Current saved location</MarkerTooltip>
                  </MapMarker>

                  {selectedCoordinates ? (
                    <MapMarker longitude={selectedCoordinates.longitude} latitude={selectedCoordinates.latitude}>
                      <MarkerContent>
                        <TerminalDot tone="candidate" />
                      </MarkerContent>
                      <MarkerTooltip>Edited location</MarkerTooltip>
                    </MapMarker>
                  ) : null}
                </Map>
              </div>
              <p className="text-xs text-muted-foreground">
                {mapEditEnabled
                  ? 'Map editing is enabled. Click once to set new coordinates.'
                  : 'Map editing is locked. Toggle the switch or double-click on the map to enable it.'}
              </p>
              <p className="text-xs text-muted-foreground">
                {selectedCoordinates
                  ? `Selected: ${selectedCoordinates.latitude.toFixed(6)}, ${selectedCoordinates.longitude.toFixed(6)}`
                  : 'No coordinates selected.'}
              </p>
            </div>

            {saveError ? <p className="text-sm text-destructive">{saveError}</p> : null}
            {saveSuccess ? <p className="text-sm text-primary">{saveSuccess}</p> : null}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={handleResetForm} disabled={saving || !hasUnsavedChanges}>
                Reset
              </Button>
              <Button type="submit" disabled={saving || !hasUnsavedChanges || !isCapacityValid} className="min-w-[150px]">
                <PendingButtonContent pending={saving} label="Save Changes" />
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
