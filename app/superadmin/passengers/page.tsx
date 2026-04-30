'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Search } from 'lucide-react';
import { AppHeader } from '@/components/app-header';
import { FilterBar } from '@/components/admin/filter-bar';
import { PageHeader } from '@/components/admin/page-header';
import { SummaryStrip } from '@/components/admin/summary-strip';
import { TableSurface } from '@/components/admin/table-surface';
import {
  FilterBarSkeleton,
  ListCardSkeleton,
  PageHeaderSkeleton,
} from '@/components/dashboard/loading-skeletons';
import { InlineErrorState } from '@/components/page-state';
import { SidebarLayout } from '@/components/sidebar-layout';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  getSuperadminPassengersData,
  type SuperadminPassengerDirectoryData,
} from '@/lib/dashboard/client';
import { useStore } from '@/lib/store-context';
import { getSuperadminSidebarItems } from '@/lib/superadmin-navigation';

function formatDateTime(value: string | Date | null) {
  if (!value) return 'No rides yet';
  return new Date(value).toLocaleString();
}

function getTenantStatusBadgeClass(status: 'active' | 'suspended') {
  return status === 'suspended'
    ? 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/15 dark:text-amber-200'
    : 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/15 dark:text-emerald-200';
}

export default function SuperadminPassengersPage() {
  const { currentUser } = useStore();
  const searchParams = useSearchParams();
  const [data, setData] = useState<SuperadminPassengerDirectoryData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [tenantFilter, setTenantFilter] = useState('all');
  const [activityFilter, setActivityFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const loadingRef = useRef(false);

  const canLoad = currentUser?.role === 'superadmin';
  const tenantParam = searchParams.get('tenantId');

  useEffect(() => {
    if (tenantParam) {
      setTenantFilter(tenantParam);
      return;
    }

    setTenantFilter('all');
  }, [tenantParam]);

  const loadData = useCallback(async () => {
    if (!canLoad || loadingRef.current) return;
    loadingRef.current = true;

    try {
      const response = await getSuperadminPassengersData({
        query: searchQuery.trim() || undefined,
        tenantId: tenantFilter === 'all' ? undefined : tenantFilter,
        activity: activityFilter,
      });
      setData(response);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load passengers.');
    } finally {
      loadingRef.current = false;
      setLoading(false);
    }
  }, [activityFilter, canLoad, searchQuery, tenantFilter]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const sidebarItems = useMemo(() => getSuperadminSidebarItems(), []);

  if (!currentUser || currentUser.role !== 'superadmin') {
    return (
      <div className="space-y-6 p-6">
        <PageHeaderSkeleton withAction />
        <FilterBarSkeleton count={3} />
        <ListCardSkeleton itemCount={5} />
      </div>
    );
  }

  const passengers = data?.passengers ?? [];
  const tenants = data?.tenants ?? [];
  const activeRows = passengers.filter(
    (passenger) => passenger.activeRideCount > 0 || passenger.activeReservationCount > 0
  ).length;

  return (
    <>
      <AppHeader />
      <div className="mx-auto max-w-7xl px-4 pb-8">
        <SidebarLayout title="Superadmin Menu" items={sidebarItems}>
          <div className="space-y-6">
            {loading ? (
              <>
                <PageHeaderSkeleton />
                <FilterBarSkeleton count={3} />
                <ListCardSkeleton itemCount={6} />
              </>
            ) : (
              <>
                <PageHeader
                  eyebrow="Passenger Oversight"
                  title="Passengers"
                  description="Search across tenants, open full passenger histories, and correct passenger profile records from the platform workspace."
                />

                <FilterBar>
                  <div className="grid gap-3 md:grid-cols-[minmax(0,1.4fr)_220px_220px]">
                    <div className="space-y-2">
                      <Label>Search</Label>
                      <div className="relative">
                        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                        <Input
                          value={searchQuery}
                          onChange={(event) => setSearchQuery(event.target.value)}
                          className="pl-9"
                          placeholder="Search passenger name, phone, or email"
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>Tenant</Label>
                      <Select value={tenantFilter} onValueChange={setTenantFilter}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All tenants</SelectItem>
                          {tenants.map((tenant) => (
                            <SelectItem key={tenant.id} value={tenant.id}>
                              {tenant.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Activity</Label>
                      <Select
                        value={activityFilter}
                        onValueChange={(value) => setActivityFilter(value as typeof activityFilter)}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All passengers</SelectItem>
                          <SelectItem value="active">Active now</SelectItem>
                          <SelectItem value="inactive">No active operations</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </FilterBar>

                {error ? (
                  <InlineErrorState
                    message={error}
                    onRetry={() => void loadData()}
                    retryLabel="Retry passengers"
                  />
                ) : null}

                <SummaryStrip
                  items={[
                    { label: 'Passengers', value: data?.stats.totalPassengers ?? 0 },
                    { label: 'Active Now', value: data?.stats.activePassengers ?? 0 },
                    { label: 'Shown', value: data?.stats.filteredPassengers ?? 0, meta: `${activeRows} active in table` },
                    { label: 'Tenants', value: tenants.length, emphasized: true },
                  ]}
                />
              </>
            )}

            <TableSurface
              title="Passenger Directory"
              description="Cross-tenant passenger visibility with direct links into tenant and passenger detail workspaces."
              bodyClassName="pt-0"
            >
              {loading ? (
                <ListCardSkeleton itemCount={5} />
              ) : passengers.length === 0 ? (
                <div className="py-10 text-center text-sm text-muted-foreground">
                  No passengers match the current filters.
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Passenger</TableHead>
                      <TableHead>Tenant</TableHead>
                      <TableHead>Activity</TableHead>
                      <TableHead>Completed</TableHead>
                      <TableHead>Last Ride</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {passengers.map((passenger) => {
                      const hasActiveWork =
                        passenger.activeRideCount > 0 || passenger.activeReservationCount > 0;

                      return (
                        <TableRow key={passenger.id}>
                          <TableCell>
                            <div className="space-y-1">
                              <p className="font-medium">{passenger.name}</p>
                              <p className="text-xs text-muted-foreground">
                                {passenger.phone ?? passenger.email ?? 'No contact on file'}
                              </p>
                            </div>
                          </TableCell>
                          <TableCell>
                            {passenger.tenant ? (
                              <div className="space-y-2">
                                <Link
                                  href={`/superadmin/tenants/${passenger.tenant.id}`}
                                  className="text-sm font-medium text-primary hover:underline"
                                >
                                  {passenger.tenant.name}
                                </Link>
                                <Badge
                                  variant="outline"
                                  className={getTenantStatusBadgeClass(passenger.tenant.status)}
                                >
                                  {passenger.tenant.status === 'suspended' ? 'Suspended' : 'Active'}
                                </Badge>
                              </div>
                            ) : (
                              <span className="text-sm text-muted-foreground">No tenant</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <div className="space-y-1 text-sm">
                              <p>{hasActiveWork ? 'Active now' : 'No live operations'}</p>
                              <p className="text-xs text-muted-foreground">
                                {passenger.activeRideCount} rides | {passenger.activeReservationCount} reservations
                              </p>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="space-y-1 text-sm">
                              <p>{passenger.completedRides}</p>
                              <p className="text-xs text-muted-foreground">
                                {passenger.rating != null ? `${passenger.rating.toFixed(1)} rating` : 'No rating yet'}
                              </p>
                            </div>
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {formatDateTime(passenger.lastRideAt)}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-2">
                              {passenger.tenant ? (
                                <Button asChild size="sm" variant="outline">
                                  <Link href={`/superadmin/tenants/${passenger.tenant.id}`}>Tenant</Link>
                                </Button>
                              ) : null}
                              <Button asChild size="sm">
                                <Link href={`/superadmin/passengers/${passenger.id}`}>Open</Link>
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </TableSurface>
          </div>
        </SidebarLayout>
      </div>
    </>
  );
}
