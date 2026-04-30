"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowRight, BusFront, Clock3, MapPin, ShieldCheck, TrendingUp } from "lucide-react";
import { AppHeader } from "@/components/app-header";
import { SummaryStrip } from "@/components/admin/summary-strip";
import { TableSurface } from "@/components/admin/table-surface";
import { PageHeader } from "@/components/admin/page-header";
import {
  DashboardQueueSkeleton,
  ListCardSkeleton,
  MapCardSkeleton,
  PageHeaderSkeleton,
  StatsCardsSkeleton,
} from "@/components/dashboard/loading-skeletons";
import { MapView, type MapPoint } from "@/components/map-view";
import { InlineErrorState } from "@/components/page-state";
import { SidebarLayout } from "@/components/sidebar-layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getAdminSidebarItems } from "@/lib/admin-navigation";
import { getAdminOverviewData, type AdminOverviewData } from "@/lib/dashboard/client";
import { useStore } from "@/lib/store-context";

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatDateTime(value: string | Date) {
  return new Intl.DateTimeFormat("en-PH", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function formatStatusLabel(status: string) {
  return status
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export default function AdminDashboardPage() {
  const { currentUser, currentTenant, currentTenantSettings } = useStore();
  const [data, setData] = useState<AdminOverviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const loadingRef = useRef(false);

  const canLoad = currentUser?.role === "admin" && Boolean(currentTenant);

  const loadData = useCallback(async () => {
    if (!canLoad || loadingRef.current) return;
    loadingRef.current = true;
    try {
      const response = await getAdminOverviewData();
      setData(response);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load dashboard.");
    } finally {
      loadingRef.current = false;
      setLoading(false);
    }
  }, [canLoad]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const sidebarItems = getAdminSidebarItems();

  if (!currentUser || currentUser.role !== "admin" || !currentTenant) {
    return (
      <div className="space-y-6 p-6">
        <PageHeaderSkeleton />
        <StatsCardsSkeleton count={4} />
      </div>
    );
  }

  const stats = data?.stats ?? {
    totalTerminals: 0,
    activeDrivers: 0,
    todayRides: 0,
    totalRevenue: 0,
  };

  const terminals = data?.terminals ?? [];
  const activeTrips = data?.activeRides ?? [];
  const widgetVisibility = currentTenantSettings?.moduleVisibility.dashboardWidgets;
  const showLiveOperations = widgetVisibility?.liveTripQueue ?? true;
  const showKpiStrip = currentTenantSettings?.uiPreferences.showKpiStrip ?? true;
  const onlineDrivers = useMemo(
    () =>
      (data?.drivers ?? [])
        .filter((driver) => driver.isOnline)
        .sort((left, right) => right.completedRides - left.completedRides)
        .slice(0, 5),
    [data?.drivers]
  );
  const queueWatch = useMemo(
    () =>
      [...terminals]
        .sort((left, right) => right.currentQueued - left.currentQueued)
        .slice(0, 5),
    [terminals]
  );
  const recentActiveTrips = useMemo(
    () =>
      [...activeTrips]
        .sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime())
        .slice(0, 6),
    [activeTrips]
  );
  const liveOperationsMapPoints = useMemo<MapPoint[]>(
    () => [
      ...activeTrips.map((trip) => ({
        id: `ride-${trip.id}`,
        latitude: trip.pickupLatitude,
        longitude: trip.pickupLongitude,
        label: trip.pickupLocation,
        description: `${formatStatusLabel(trip.status)} to ${trip.dropoffLocation}`,
        tone: "ride" as const,
      })),
      ...terminals.map((terminal) => ({
        id: `terminal-${terminal.id}`,
        latitude: terminal.latitude,
        longitude: terminal.longitude,
        label: terminal.name,
        description: `${terminal.location} • ${terminal.currentQueued} queued`,
        tone: "terminal" as const,
      })),
    ],
    [activeTrips, terminals]
  );

  return (
    <>
      <AppHeader />
      <div className="max-w-7xl mx-auto px-4 pb-8">
        <SidebarLayout title="Admin Menu" items={sidebarItems}>
          <div className="space-y-6">
            {loading ? (
              <>
                <PageHeaderSkeleton />
                <StatsCardsSkeleton count={4} className="md:grid-cols-2 xl:grid-cols-4" />
                <div className="grid gap-6 xl:grid-cols-[1.5fr_1fr]">
                  <div className="space-y-6">
                    <MapCardSkeleton heightClassName="h-[320px]" />
                    <DashboardQueueSkeleton rowCount={6} />
                  </div>
                  <div className="space-y-6">
                    <DashboardQueueSkeleton rowCount={4} />
                    <DashboardQueueSkeleton rowCount={4} />
                    <ListCardSkeleton itemCount={4} />
                  </div>
                </div>
              </>
            ) : (
              <>
                <PageHeader
                  eyebrow="Tenant Operations"
                  title="Dashboard"
                  description={`Live tenant operations for ${currentTenant.name}, focused on queues, active trips, and drivers on duty.`}
                />

                {error ? (
                  <InlineErrorState
                    message={error}
                    onRetry={() => void loadData()}
                    retryLabel="Retry dashboard"
                  />
                ) : null}

                {showKpiStrip ? (
                  <SummaryStrip
                    items={[
                      { label: 'TODAs', value: stats.totalTerminals, icon: <MapPin className="h-5 w-5" /> },
                      { label: 'Verified Online', value: stats.activeDrivers, icon: <ShieldCheck className="h-5 w-5" /> },
                      { label: 'Active Trips', value: activeTrips.length, icon: <BusFront className="h-5 w-5" /> },
                      {
                        label: "Today's Trips",
                        value: stats.todayRides,
                        meta: `${formatCurrency(stats.totalRevenue)} commission today`,
                        icon: <TrendingUp className="h-5 w-5" />,
                        emphasized: true,
                      },
                    ]}
                  />
                ) : null}

                <div className="grid gap-6 xl:grid-cols-[1.5fr_1fr]">
                  <div className="space-y-6">
                    {showLiveOperations ? (
                      <TableSurface
                        title="Live Operations Map"
                        description="Track active trip pickups and terminal coverage across the city."
                        bodyClassName="pt-0"
                      >
                        {liveOperationsMapPoints.length === 0 ? (
                          <div className="flex h-[320px] items-center justify-center rounded-lg border border-dashed text-sm text-muted-foreground">
                            No terminal or trip map points available yet.
                          </div>
                        ) : (
                          <MapView points={liveOperationsMapPoints} showRoute={false} height="h-[320px]" />
                        )}
                      </TableSurface>
                    ) : null}

                    {showLiveOperations ? (
                      <TableSurface
                        title="Live Trip Queue"
                        description="Trips currently moving through search, dispatch, pickup, or in-trip states."
                        actions={
                          <Button asChild variant="ghost" size="sm">
                            <Link href="/admin/rides">
                              View trips
                              <ArrowRight className="h-4 w-4" />
                            </Link>
                          </Button>
                        }
                        bodyClassName="pt-0"
                      >
                        {recentActiveTrips.length === 0 ? (
                          <div className="flex h-40 items-center justify-center rounded-lg border border-dashed text-sm text-muted-foreground">
                            No active trips right now.
                          </div>
                        ) : (
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>Route</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead>Requested</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {recentActiveTrips.map((trip) => (
                                <TableRow key={trip.id}>
                                  <TableCell>
                                    <div className="space-y-1">
                                      <p className="font-medium">{trip.pickupLocation}</p>
                                      <p className="text-xs text-muted-foreground">to {trip.dropoffLocation}</p>
                                    </div>
                                  </TableCell>
                                  <TableCell>{formatStatusLabel(trip.status)}</TableCell>
                                  <TableCell>{formatDateTime(trip.createdAt)}</TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        )}
                      </TableSurface>
                    ) : null}
                  </div>

                  <div className="space-y-6">
                    {(widgetVisibility?.queueWatch ?? true) ? (
                    <TableSurface
                      title="TODA Queue Watch"
                      description="Watch which terminals need attention first."
                      actions={
                        <Button asChild variant="ghost" size="sm">
                          <Link href="/admin/terminals">
                            View TODAs
                            <ArrowRight className="h-4 w-4" />
                          </Link>
                        </Button>
                      }
                      bodyClassName="pt-0"
                    >
                        {queueWatch.length === 0 ? (
                          <div className="flex h-32 items-center justify-center rounded-lg border border-dashed text-sm text-muted-foreground">
                            No TODAs available yet.
                          </div>
                        ) : (
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>TODA</TableHead>
                                <TableHead>Queue</TableHead>
                                <TableHead>Capacity</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {queueWatch.map((terminal) => (
                                <TableRow key={terminal.id}>
                                  <TableCell>
                                    <div className="space-y-1">
                                      <p className="font-medium">{terminal.name}</p>
                                      <p className="text-xs text-muted-foreground">{terminal.location}</p>
                                    </div>
                                  </TableCell>
                                  <TableCell>{terminal.currentQueued}</TableCell>
                                  <TableCell>{terminal.capacity}</TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                            </Table>
                        )}
                    </TableSurface>
                    ) : null}

                    {(widgetVisibility?.onlineDrivers ?? true) ? (
                    <TableSurface
                      title="Verified Drivers Online"
                      description="Quick access to the drivers most ready to operate."
                      actions={
                        <Button asChild variant="ghost" size="sm">
                          <Link href="/admin/drivers">
                            View drivers
                            <ArrowRight className="h-4 w-4" />
                          </Link>
                        </Button>
                      }
                      bodyClassName="pt-0"
                    >
                        {onlineDrivers.length === 0 ? (
                          <div className="flex h-32 items-center justify-center rounded-lg border border-dashed text-sm text-muted-foreground">
                            No verified drivers are online.
                          </div>
                        ) : (
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>Driver</TableHead>
                                <TableHead>Completed</TableHead>
                                <TableHead>Rating</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {onlineDrivers.map((driver) => (
                                <TableRow key={driver.id}>
                                  <TableCell className="font-medium">{driver.name}</TableCell>
                                  <TableCell>{driver.completedRides}</TableCell>
                                  <TableCell>{driver.rating?.toFixed(1) ?? "No rating"}</TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                            </Table>
                        )}
                    </TableSurface>
                    ) : null}

                    {(widgetVisibility?.operationalSummary ?? true) ? (
                    <Card className="border-border/70 bg-card/86">
                      <CardHeader className="pb-3">
                        <CardTitle>Operational Summary</CardTitle>
                        <CardDescription>Use the highest-traffic queues and live trip volume to decide where to intervene next.</CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-2 text-sm text-muted-foreground">
                        <div className="flex items-center justify-between rounded-lg border px-3 py-2">
                          <span>Top queue pressure</span>
                          <span className="font-medium text-foreground">{queueWatch[0]?.name ?? "None"}</span>
                        </div>
                        <div className="flex items-center justify-between rounded-lg border px-3 py-2">
                          <span>Trips in motion</span>
                          <span className="font-medium text-foreground">{activeTrips.length}</span>
                        </div>
                        <div className="flex items-center justify-between rounded-lg border px-3 py-2">
                          <span>Drivers available now</span>
                          <span className="font-medium text-foreground">{stats.activeDrivers}</span>
                        </div>
                        <div className="flex items-center justify-between rounded-lg border px-3 py-2">
                          <span>Last live update</span>
                          <span className="font-medium text-foreground">{formatDateTime(new Date())}</span>
                        </div>
                      </CardContent>
                    </Card>
                    ) : null}
                  </div>
                </div>
              </>
            )}
          </div>
        </SidebarLayout>
      </div>
    </>
  );
}
