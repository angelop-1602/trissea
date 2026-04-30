'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppHeader } from '@/components/app-header';
import { FilterBar } from '@/components/admin/filter-bar';
import { PageHeader } from '@/components/admin/page-header';
import { SummaryStrip } from '@/components/admin/summary-strip';
import { TableSurface } from '@/components/admin/table-surface';
import {
  ListCardSkeleton,
  PageHeaderSkeleton,
  StatsCardsSkeleton,
} from '@/components/dashboard/loading-skeletons';
import { InlineErrorState } from '@/components/page-state';
import { SidebarLayout } from '@/components/sidebar-layout';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { getSuperadminReportsData, type SuperadminReportsData } from '@/lib/dashboard/client';
import { useStore } from '@/lib/store-context';
import { getSuperadminSidebarItems } from '@/lib/superadmin-navigation';

function formatCurrency(value: number) {
  return new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: 'PHP',
    maximumFractionDigits: 0,
  }).format(value);
}

export default function SuperadminReportsPage() {
  const { currentUser } = useStore();
  const [data, setData] = useState<SuperadminReportsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tenantFilter, setTenantFilter] = useState('all');
  const loadingRef = useRef(false);

  const canLoad = currentUser?.role === 'superadmin';
  const sidebarItems = useMemo(() => getSuperadminSidebarItems(), []);

  const loadData = useCallback(async () => {
    if (!canLoad || loadingRef.current) return;
    loadingRef.current = true;
    try {
      const response = await getSuperadminReportsData();
      setData(response);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load reports.');
    } finally {
      loadingRef.current = false;
      setLoading(false);
    }
  }, [canLoad]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  if (!currentUser || currentUser.role !== 'superadmin') {
    return (
      <div className="space-y-6 p-6">
        <PageHeaderSkeleton />
        <StatsCardsSkeleton count={4} />
        <ListCardSkeleton itemCount={5} />
      </div>
    );
  }

  const stats = data?.stats ?? {
    totalRides: 0,
    totalRevenue: 0,
    totalCommission: 0,
    averagePerRide: 0,
  };
  const tenantPerformance = data?.tenantPerformance ?? [];
  const filteredTenantPerformance =
    tenantFilter === 'all'
      ? tenantPerformance
      : tenantPerformance.filter((tenant) => tenant.id === tenantFilter);
  const filteredRides = filteredTenantPerformance.reduce((sum, tenant) => sum + tenant.rides, 0);
  const filteredRevenue = filteredTenantPerformance.reduce((sum, tenant) => sum + tenant.revenue, 0);
  const filteredCommission = filteredRevenue * 0.1;
  const filteredAverage = filteredRides === 0 ? 0 : filteredRevenue / filteredRides;

  return (
    <>
      <AppHeader />
      <div className="mx-auto max-w-7xl px-4 pb-8">
        <SidebarLayout title="Superadmin Menu" items={sidebarItems}>
          <div className="space-y-6">
            {loading ? (
              <>
                <PageHeaderSkeleton />
                <StatsCardsSkeleton count={4} className="md:grid-cols-2 lg:grid-cols-4" />
                <ListCardSkeleton itemCount={5} />
              </>
            ) : (
              <>
                <PageHeader
                  eyebrow="System Reporting"
                  title="Platform Analytics"
                  description="Review platform revenue, filter performance by tenant, and drill into the tenant and passenger workspaces from the same reporting surface."
                />

                {error ? (
                  <InlineErrorState
                    message={error}
                    onRetry={() => void loadData()}
                    retryLabel="Retry reports"
                  />
                ) : null}

                <FilterBar>
                  <div className="grid gap-3 md:grid-cols-[260px_minmax(0,1fr)]">
                    <div className="space-y-2">
                      <Label>Tenant Scope</Label>
                      <Select value={tenantFilter} onValueChange={setTenantFilter}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All tenants</SelectItem>
                          {tenantPerformance.map((tenant) => (
                            <SelectItem key={tenant.id} value={tenant.id}>
                              {tenant.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex items-end text-sm text-muted-foreground">
                      {tenantFilter === 'all'
                        ? 'Showing platform-wide revenue and ride performance.'
                        : 'Showing the selected tenant summary while keeping direct links into tenant and passenger oversight.'}
                    </div>
                  </div>
                </FilterBar>

                <SummaryStrip
                  items={[
                    { label: 'Trips', value: tenantFilter === 'all' ? stats.totalRides : filteredRides },
                    {
                      label: 'Revenue',
                      value: formatCurrency(tenantFilter === 'all' ? stats.totalRevenue : filteredRevenue),
                    },
                    {
                      label: 'Commission',
                      value: formatCurrency(tenantFilter === 'all' ? stats.totalCommission : filteredCommission),
                    },
                    {
                      label: 'Avg per Trip',
                      value: formatCurrency(tenantFilter === 'all' ? stats.averagePerRide : filteredAverage),
                      emphasized: true,
                    },
                  ]}
                />

                <TableSurface
                  title="Tenant Performance"
                  description="Use this table as the jump-off point into tenant operations and tenant-scoped passenger oversight."
                  bodyClassName="pt-0"
                >
                  {filteredTenantPerformance.length === 0 ? (
                    <div className="py-8 text-sm text-muted-foreground">
                      No tenant performance data is available for the current filter.
                    </div>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Tenant</TableHead>
                          <TableHead>Trips</TableHead>
                          <TableHead>Revenue</TableHead>
                          <TableHead>Commission</TableHead>
                          <TableHead>Avg Fare</TableHead>
                          <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredTenantPerformance.map((tenant) => {
                          const averageFare = tenant.rides === 0 ? 0 : tenant.revenue / tenant.rides;
                          return (
                            <TableRow key={tenant.id}>
                              <TableCell>
                                <div className="space-y-1">
                                  <p className="font-medium">{tenant.name}</p>
                                  <p className="text-xs text-muted-foreground">{tenant.rides} rides recorded</p>
                                </div>
                              </TableCell>
                              <TableCell>{tenant.rides}</TableCell>
                              <TableCell>{formatCurrency(tenant.revenue)}</TableCell>
                              <TableCell>{formatCurrency(tenant.revenue * 0.1)}</TableCell>
                              <TableCell>{formatCurrency(averageFare)}</TableCell>
                              <TableCell className="text-right">
                                <div className="flex justify-end gap-2">
                                  <Button asChild size="sm" variant="outline">
                                    <Link href={`/superadmin/passengers?tenantId=${tenant.id}`}>Passengers</Link>
                                  </Button>
                                  <Button asChild size="sm">
                                    <Link href={`/superadmin/tenants/${tenant.id}`}>Open Tenant</Link>
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
              </>
            )}
          </div>
        </SidebarLayout>
      </div>
    </>
  );
}
