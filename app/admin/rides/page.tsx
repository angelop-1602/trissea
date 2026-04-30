'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppHeader } from '@/components/app-header';
import { PageHeader } from '@/components/admin/page-header';
import { AdminSubnavRail } from '@/components/admin/subnav-rail';
import { SummaryStrip } from '@/components/admin/summary-strip';
import { TableSurface } from '@/components/admin/table-surface';
import { PageHeaderSkeleton, StatsCardsSkeleton, SubnavRailSkeleton, TableCardSkeleton } from '@/components/dashboard/loading-skeletons';
import { InlineErrorState } from '@/components/page-state';
import { SidebarLayout } from '@/components/sidebar-layout';
import { DataTable } from '@/components/data-table';
import { StatusBadge } from '@/components/status-badge';
import { getAdminSidebarItems } from '@/lib/admin-navigation';
import { getAdminRidesData, type AdminRidesData } from '@/lib/dashboard/client';
import { useStore } from '@/lib/store-context';

type TripTab = 'active' | 'completed' | 'cancelled';

function getTripTab(status: string): TripTab {
  if (status === 'completed') return 'completed';
  if (status === 'cancelled') return 'cancelled';
  return 'active';
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP', maximumFractionDigits: 0 }).format(value);
}

function formatDateTime(value: string | Date) {
  return new Intl.DateTimeFormat('en-PH', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(value));
}

export default function AdminRidesPage() {
  const { currentUser, currentTenant, currentTenantSettings } = useStore();
  const [data, setData] = useState<AdminRidesData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TripTab>('active');
  const loadingRef = useRef(false);

  const canLoad = currentUser?.role === 'admin' && Boolean(currentTenant);

  const loadData = useCallback(async () => {
    if (!canLoad || loadingRef.current) return;
    loadingRef.current = true;
    try {
      const response = await getAdminRidesData();
      setData(response);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load trips.');
    } finally {
      loadingRef.current = false;
      setLoading(false);
    }
  }, [canLoad]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  useEffect(() => {
    setActiveTab(currentTenantSettings?.operationsPreferences.tripsDefaultTab ?? 'active');
  }, [currentTenantSettings?.operationsPreferences.tripsDefaultTab]);

  const sidebarItems = getAdminSidebarItems();

  if (!currentUser || currentUser.role !== 'admin' || !currentTenant) {
    return (
      <div className="space-y-6 p-6">
        <PageHeaderSkeleton />
        <StatsCardsSkeleton count={3} className="md:grid-cols-3" />
      </div>
    );
  }

  const rides = data?.rides ?? [];
  const tabs = [
    {
      value: 'active' as const,
      label: 'Active',
      count: rides.filter((ride) => getTripTab(ride.status) === 'active').length,
      description: 'Searching, matched, en route, arrived, and in-trip requests that still need active monitoring.',
    },
    {
      value: 'completed' as const,
      label: 'Completed',
      count: rides.filter((ride) => getTripTab(ride.status) === 'completed').length,
      description: 'Closed trip records that support fare review, reporting, and passenger history checks.',
    },
    {
      value: 'cancelled' as const,
      label: 'Cancelled',
      count: rides.filter((ride) => getTripTab(ride.status) === 'cancelled').length,
      description: 'Trips that were cancelled before completion and may still need operational follow-up.',
    },
  ];
  const activeTabConfig = tabs.find((tab) => tab.value === activeTab) ?? tabs[0];

  const tripRows = useMemo(
    () =>
      rides
        .filter((ride) => getTripTab(ride.status) === activeTab)
        .map((ride) => ({
          id: ride.id,
          pickupLocation: ride.pickupLocation,
          dropoffLocation: ride.dropoffLocation,
          fare: ride.fare,
          status: ride.status,
          createdAt: ride.createdAt,
          rideType: ride.rideType,
        })),
    [activeTab, rides]
  );

  const columns = [
    {
      key: 'pickupLocation' as const,
      label: 'Route',
      render: (value: string, row: (typeof tripRows)[number]) => (
        <div className="space-y-1">
          <p className="font-medium">{value}</p>
          <p className="text-xs text-muted-foreground">to {row.dropoffLocation}</p>
        </div>
      ),
    },
    {
      key: 'rideType' as const,
      label: 'Type',
      render: (value: string) => <span className="capitalize">{value.replaceAll('_', ' ')}</span>,
    },
    {
      key: 'createdAt' as const,
      label: 'Requested',
      render: (value: string | Date) => formatDateTime(value),
    },
    {
      key: 'fare' as const,
      label: 'Fare',
      render: (value: number) => <span className="font-medium">{formatCurrency(value)}</span>,
    },
    {
      key: 'status' as const,
      label: 'Status',
      render: (value: string) => <StatusBadge status={value} />,
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
                <PageHeaderSkeleton />
                <StatsCardsSkeleton count={3} className="md:grid-cols-3" />
                <div className="grid gap-6 lg:grid-cols-[240px_minmax(0,1fr)]">
                  <SubnavRailSkeleton itemCount={3} />
                  <TableCardSkeleton columnCount={5} rowCount={8} />
                </div>
              </>
            ) : (
              <>
                <PageHeader
                  eyebrow="Trip Execution"
                  title="Trips"
                  description="Monitor trip execution separately from reservations, using grouped workflow states and a table-first view."
                />

                {error ? (
                  <InlineErrorState
                    message={error}
                    onRetry={() => void loadData()}
                    retryLabel="Retry trips"
                  />
                ) : null}

                <SummaryStrip items={tabs.map((tab) => ({ label: tab.label, value: tab.count }))} className="md:grid-cols-3 xl:grid-cols-3" />
              </>
            )}
            {!loading ? (
              <div className="grid gap-6 lg:grid-cols-[240px_minmax(0,1fr)]">
                <aside className="space-y-4 pt-1">
                  <AdminSubnavRail
                    title="Trip Queues"
                    items={tabs.map((tab) => ({
                      key: tab.value,
                      label: tab.label,
                      description: tab.description,
                      badge: tab.count,
                      active: tab.value === activeTab,
                      onClick: () => setActiveTab(tab.value),
                    }))}
                  />
                </aside>

                <TableSurface
                  title={`${activeTabConfig.label} Trips`}
                  description={activeTabConfig.description}
                  bodyClassName="pt-0"
                >
                  <DataTable
                    data={tripRows}
                    columns={columns}
                    isLoading={loading}
                    embedded
                    emptyTitle={`No ${activeTab} trips found`}
                    emptyDescription="Trips will appear here as booking activity changes."
                  />
                </TableSurface>
              </div>
            ) : null}
          </div>
        </SidebarLayout>
      </div>
    </>
  );
}
