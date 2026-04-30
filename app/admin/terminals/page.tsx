'use client';

import Link from 'next/link';
import type { FormEvent } from 'react';
import type { MapMouseEvent } from 'maplibre-gl';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useStore } from '@/lib/store-context';
import { AppHeader } from '@/components/app-header';
import { PageHeader } from '@/components/admin/page-header';
import { SummaryStrip } from '@/components/admin/summary-strip';
import { TableSurface } from '@/components/admin/table-surface';
import { PageHeaderSkeleton, StatsCardsSkeleton, TableCardSkeleton } from '@/components/dashboard/loading-skeletons';
import { InlineErrorState } from '@/components/page-state';
import { SidebarLayout } from '@/components/sidebar-layout';
import { Map, MapControls, MapMarker, MarkerContent, MarkerTooltip, useMap } from '@/components/ui/map';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { PendingButtonContent } from '@/components/ui/pending-button-content';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { DataTable } from '@/components/data-table';
import { MapPin, Plus, Users } from 'lucide-react';
import { createAdminTerminal, getAdminTerminalsData, type AdminTerminalsData } from '@/lib/dashboard/client';
import { getAdminSidebarItems } from '@/lib/admin-navigation';
import { cn } from '@/lib/utils';

type Coordinates = {
  latitude: number;
  longitude: number;
};

const DEFAULT_MAP_CENTER: [number, number] = [121.0244, 14.5547];

function TerminalMapClickCapture({ onPick }: { onPick: (coordinates: Coordinates) => void }) {
  const { map, isLoaded } = useMap();

  useEffect(() => {
    if (!map || !isLoaded) return;

    const handleMapClick = (event: MapMouseEvent) => {
      onPick({
        latitude: event.lngLat.lat,
        longitude: event.lngLat.lng,
      });
    };

    const canvas = map.getCanvas();
    const previousCursor = canvas.style.cursor;
    canvas.style.cursor = 'crosshair';
    map.on('click', handleMapClick);

    return () => {
      map.off('click', handleMapClick);
      canvas.style.cursor = previousCursor;
    };
  }, [map, isLoaded, onPick]);

  return null;
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

function TerminalDot({ tone = 'existing' }: { tone?: 'existing' | 'candidate' }) {
  return (
    <div
      className={cn(
        'h-3.5 w-3.5 rounded-full border-2 border-background shadow-md ring-2 ring-border/70',
        tone === 'candidate' ? 'bg-primary' : 'bg-secondary'
      )}
    />
  );
}

export default function AdminTerminalsPage() {
  const { currentUser, currentTenant } = useStore();
  const [data, setData] = useState<AdminTerminalsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [terminalName, setTerminalName] = useState('');
  const [terminalLocation, setTerminalLocation] = useState('');
  const [selectedCoordinates, setSelectedCoordinates] = useState<Coordinates | null>(null);
  const [creating, setCreating] = useState(false);
  const loadingRef = useRef(false);

  const canLoad = currentUser?.role === 'admin' && Boolean(currentTenant);

  const loadData = useCallback(async () => {
    if (!canLoad || loadingRef.current) return;
    loadingRef.current = true;
    try {
      const response = await getAdminTerminalsData();
      setData(response);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load terminals.');
    } finally {
      loadingRef.current = false;
      setLoading(false);
    }
  }, [canLoad]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const resetCreateTerminalForm = useCallback(() => {
    setTerminalName('');
    setTerminalLocation('');
    setSelectedCoordinates(null);
    setCreateError(null);
  }, []);

  const handleAddDialogOpenChange = useCallback(
    (open: boolean) => {
      setIsAddDialogOpen(open);
      if (!open) {
        resetCreateTerminalForm();
      }
    },
    [resetCreateTerminalForm]
  );

  const onPickCoordinates = useCallback((coordinates: Coordinates) => {
    setSelectedCoordinates(coordinates);
    setCreateError(null);
  }, []);

  const handleCreateTerminal = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (!canLoad || creating) return;

      const name = terminalName.trim();
      const location = terminalLocation.trim();

      if (!name || !location) {
        setCreateError('Terminal name and location are required.');
        return;
      }

      if (!selectedCoordinates) {
        setCreateError('Pick terminal coordinates from the map.');
        return;
      }

      setCreating(true);
      try {
        await createAdminTerminal({
          name,
          location,
          latitude: selectedCoordinates.latitude,
          longitude: selectedCoordinates.longitude,
        });

        resetCreateTerminalForm();
        setIsAddDialogOpen(false);
        await loadData();
      } catch (err) {
        setCreateError(err instanceof Error ? err.message : 'Failed to create terminal.');
      } finally {
        setCreating(false);
      }
    },
    [canLoad, creating, loadData, resetCreateTerminalForm, selectedCoordinates, terminalLocation, terminalName]
  );

  const sidebarItems = getAdminSidebarItems();

  if (!currentUser || currentUser.role !== 'admin' || !currentTenant) {
    return (
      <div className="space-y-6 p-6">
        <PageHeaderSkeleton withAction />
        <StatsCardsSkeleton count={3} className="md:grid-cols-3" />
        <TableCardSkeleton columnCount={4} />
      </div>
    );
  }

  const terminals = data?.terminals ?? [];
  const stats = data?.stats ?? { totalTerminals: 0, totalCapacity: 0, currentlyQueued: 0 };
  const firstTerminal = terminals[0];
  const focusCoordinates: Coordinates | null = selectedCoordinates
    ? selectedCoordinates
    : firstTerminal
      ? {
          latitude: firstTerminal.latitude,
          longitude: firstTerminal.longitude,
        }
      : null;

  const terminalData = terminals.map((terminal) => ({
    id: terminal.id,
    name: terminal.name,
    location: terminal.location,
    capacity: terminal.capacity,
    currentQueued: terminal.currentQueued,
    actions: terminal.id,
  }));

  const columns = [
    {
      key: 'name' as const,
      label: 'Terminal',
      render: (value: string, row: (typeof terminalData)[number]) => (
        <div>
          <p className="font-medium text-sm">{value}</p>
          <p className="text-xs text-muted-foreground">{row.location}</p>
        </div>
      ),
    },
    {
      key: 'currentQueued' as const,
      label: 'Queued',
      render: (value: number) => <span className="font-medium">{value}</span>,
    },
    {
      key: 'capacity' as const,
      label: 'Capacity',
      render: (value: number, row: (typeof terminalData)[number]) => (
        <span className="text-sm">
          {row.currentQueued}/{value}
        </span>
      ),
    },
    {
      key: 'actions' as const,
      label: 'Actions',
      className: 'w-[110px] text-right',
      render: (_value: string, row: (typeof terminalData)[number]) => (
        <Button variant="outline" size="sm" asChild>
          <Link href={`/admin/terminals/${row.id}`}>View</Link>
        </Button>
      ),
    },
  ];

  return (
    <>
      <AppHeader />
      <div className="max-w-7xl mx-auto px-4 pb-8">
        <SidebarLayout title="Admin Menu" items={sidebarItems}>
          <div className="space-y-6">
            {loading ? (
              <>
                <PageHeaderSkeleton withAction />
                <StatsCardsSkeleton count={3} className="md:grid-cols-3" />
              </>
            ) : (
              <>
                <PageHeader
                  eyebrow="Terminal Network"
                  title="TODAs"
                  description={`Manage all TODA terminals for ${currentTenant.name}.`}
                  actions={
                  <Dialog open={isAddDialogOpen} onOpenChange={handleAddDialogOpenChange}>
                    <DialogTrigger asChild>
                      <Button>
                        <Plus className="h-4 w-4" />
                        Add Terminal
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="w-[96vw] sm:max-w-6xl xl:max-w-7xl max-h-[94vh] overflow-y-auto">
                      <DialogHeader>
                        <DialogTitle>Add Terminal</DialogTitle>
                        <DialogDescription>
                          Enter terminal details and click the map to set exact coordinates.
                        </DialogDescription>
                      </DialogHeader>

                      <form className="space-y-4" onSubmit={handleCreateTerminal}>
                        <div className="grid gap-4 md:grid-cols-2">
                          <div className="space-y-2">
                            <Label htmlFor="terminal-name">Terminal name</Label>
                            <Input
                              id="terminal-name"
                              value={terminalName}
                              onChange={(event) => setTerminalName(event.target.value)}
                              placeholder="e.g. Centro TODA Terminal"
                              maxLength={120}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="terminal-location">Location label</Label>
                            <Input
                              id="terminal-location"
                              value={terminalLocation}
                              onChange={(event) => setTerminalLocation(event.target.value)}
                              placeholder="e.g. Near City Hall"
                              maxLength={200}
                            />
                          </div>
                        </div>

                        <div className="space-y-2">
                          <Label>Pick on map</Label>
                          <div className="h-[42vh] min-h-[360px] max-h-[620px] overflow-hidden rounded-lg border border-border">
                            <Map
                              center={focusCoordinates ? [focusCoordinates.longitude, focusCoordinates.latitude] : DEFAULT_MAP_CENTER}
                              zoom={focusCoordinates ? 13 : 6}
                              attributionControl={false}
                              className="h-full w-full"
                              cooperativeGestures
                            >
                              <MapControls position="bottom-right" showZoom showLocate showFullscreen />
                              <TerminalMapClickCapture onPick={onPickCoordinates} />
                              <FocusTerminalMap coordinates={focusCoordinates} />

                              {terminals.map((terminal) => (
                                <MapMarker key={terminal.id} longitude={terminal.longitude} latitude={terminal.latitude}>
                                  <MarkerContent>
                                    <TerminalDot tone="existing" />
                                  </MarkerContent>
                                  <MarkerTooltip>
                                    <div className="space-y-0.5">
                                      <p className="font-medium">{terminal.name}</p>
                                      <p className="text-[11px] opacity-80">{terminal.location}</p>
                                    </div>
                                  </MarkerTooltip>
                                </MapMarker>
                              ))}

                              {selectedCoordinates ? (
                                <MapMarker longitude={selectedCoordinates.longitude} latitude={selectedCoordinates.latitude}>
                                  <MarkerContent>
                                    <TerminalDot tone="candidate" />
                                  </MarkerContent>
                                  <MarkerTooltip>New terminal location</MarkerTooltip>
                                </MapMarker>
                              ) : null}
                            </Map>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            {selectedCoordinates
                              ? `Selected: ${selectedCoordinates.latitude.toFixed(6)}, ${selectedCoordinates.longitude.toFixed(6)}`
                              : 'Click anywhere on the map to set terminal coordinates.'}
                          </p>
                          <p className="text-xs text-muted-foreground">New terminals start with default capacity of 35.</p>
                        </div>

                        {createError ? <p className="text-sm text-destructive">{createError}</p> : null}

                        <DialogFooter>
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => handleAddDialogOpenChange(false)}
                            disabled={creating}
                          >
                            Cancel
                          </Button>
                          <Button type="submit" disabled={creating} className="min-w-[160px]">
                            <PendingButtonContent
                              pending={creating}
                              label="Create Terminal"
                              icon={<Plus className="h-4 w-4" />}
                            />
                          </Button>
                        </DialogFooter>
                      </form>
                    </DialogContent>
                  </Dialog>
                  }
                />

                {error ? (
                  <InlineErrorState
                    message={error}
                    onRetry={() => void loadData()}
                    retryLabel="Retry terminals"
                  />
                ) : null}

                <SummaryStrip
                  items={[
                    {
                      label: 'TODAs',
                      value: stats.totalTerminals,
                      meta: 'Registered terminal workspaces',
                      icon: <MapPin className="h-5 w-5" />,
                    },
                    {
                      label: 'Total Capacity',
                      value: stats.totalCapacity,
                      meta: 'Combined queue capacity',
                      icon: <Users className="h-5 w-5" />,
                    },
                    {
                      label: 'Queued Now',
                      value: stats.currentlyQueued,
                      meta: 'Passengers currently waiting',
                      emphasized: true,
                    },
                  ]}
                  className="md:grid-cols-3 xl:grid-cols-3"
                />
              </>
            )}

            <TableSurface
              title="TODA List"
              description="All registered TODA terminals for this tenant workspace."
              bodyClassName="pt-0"
            >
              <DataTable
                data={terminalData}
                columns={columns}
                isLoading={loading}
                embedded
                emptyTitle="No terminals yet"
                emptyDescription="Add your first terminal to start managing queues."
              />
            </TableSurface>
          </div>
        </SidebarLayout>
      </div>
    </>
  );
}
