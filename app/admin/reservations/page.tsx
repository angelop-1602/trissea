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
import { getAdminReservationsData, type AdminReservationsData } from '@/lib/dashboard/client';
import { useStore } from '@/lib/store-context';

type ReservationTab = 'active' | 'completed' | 'cancelled';

function getReservationTab(status: string): ReservationTab {
  if (status === 'completed') return 'completed';
  if (status === 'cancelled') return 'cancelled';
  return 'active';
}

function formatDateTime(value: string | Date) {
  return new Intl.DateTimeFormat('en-PH', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(value));
}

export default function AdminReservationsPage() {
  const { currentUser, currentTenant, currentTenantSettings } = useStore();
  const [data, setData] = useState<AdminReservationsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<ReservationTab>('active');
  const loadingRef = useRef(false);

  const canLoad = currentUser?.role === 'admin' && Boolean(currentTenant);

  const loadData = useCallback(async () => {
    if (!canLoad || loadingRef.current) return;
    loadingRef.current = true;
    try {
      const response = await getAdminReservationsData();
      setData(response);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load reservations.');
    } finally {
      loadingRef.current = false;
      setLoading(false);
    }
  }, [canLoad]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  useEffect(() => {
    setActiveTab(currentTenantSettings?.operationsPreferences.reservationsDefaultTab ?? 'active');
  }, [currentTenantSettings?.operationsPreferences.reservationsDefaultTab]);

  const sidebarItems = getAdminSidebarItems();

  if (!currentUser || currentUser.role !== 'admin' || !currentTenant) {
    return (
      <div className="space-y-6 p-6">
        <PageHeaderSkeleton />
        <StatsCardsSkeleton count={3} className="md:grid-cols-3" />
      </div>
    );
  }

  const reservations = data?.reservations ?? [];
  const tabs = [
    {
      value: 'active' as const,
      label: 'Active',
      count: reservations.filter((item) => getReservationTab(item.status) === 'active').length,
      description: 'Pending, confirmed, and arrived queue states grouped into one active operating list.',
    },
    {
      value: 'completed' as const,
      label: 'Completed',
      count: reservations.filter((item) => getReservationTab(item.status) === 'completed').length,
      description: 'Finished terminal reservations that support boarding audits and daily queue reporting.',
    },
    {
      value: 'cancelled' as const,
      label: 'Cancelled',
      count: reservations.filter((item) => getReservationTab(item.status) === 'cancelled').length,
      description: 'Reservations cancelled before boarding and kept for review when queue activity changes.',
    },
  ];
  const activeTabConfig = tabs.find((tab) => tab.value === activeTab) ?? tabs[0];

  const rows = useMemo(
    () =>
      reservations
        .filter((reservation) => getReservationTab(reservation.status) === activeTab)
        .map((reservation) => ({
          id: reservation.id,
          passenger: reservation.User?.name ?? 'Unknown',
          terminal: reservation.TODATerminal?.name ?? 'Unknown',
          queuePosition: reservation.queuePosition,
          status: reservation.status,
          boardingTime: reservation.boardingTime,
          createdAt: reservation.createdAt,
        })),
    [activeTab, reservations]
  );

  const columns = [
    {
      key: 'passenger' as const,
      label: 'Passenger',
      render: (value: string, row: (typeof rows)[number]) => (
        <div className="space-y-1">
          <span className="font-medium">{value}</span>
          <p className="text-xs text-muted-foreground">Queued at {formatDateTime(row.createdAt)}</p>
        </div>
      ),
    },
    {
      key: 'terminal' as const,
      label: 'TODA',
      render: (value: string) => <span className="text-sm">{value}</span>,
    },
    {
      key: 'queuePosition' as const,
      label: 'Queue #',
      render: (value: number) => <span className="font-medium">{value}</span>,
    },
    {
      key: 'boardingTime' as const,
      label: 'Boarding',
      render: (value: string | Date) => formatDateTime(value),
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
                  eyebrow="Reservation Queue"
                  title="Reservations"
                  description="Track queue reservations separately from live trips, with grouped workflow states for daily operations."
                />

                {error ? (
                  <InlineErrorState
                    message={error}
                    onRetry={() => void loadData()}
                    retryLabel="Retry reservations"
                  />
                ) : null}

                <SummaryStrip items={tabs.map((tab) => ({ label: tab.label, value: tab.count }))} className="md:grid-cols-3 xl:grid-cols-3" />
              </>
            )}
            {!loading ? (
              <div className="grid gap-6 lg:grid-cols-[240px_minmax(0,1fr)]">
                <aside className="space-y-4 pt-1">
                  <AdminSubnavRail
                    title="Reservation Queues"
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
                  title={`${activeTabConfig.label} Reservations`}
                  description={activeTabConfig.description}
                  bodyClassName="pt-0"
                >
                  <DataTable
                    data={rows}
                    columns={columns}
                    isLoading={loading}
                    embedded
                    emptyTitle={`No ${activeTab} reservations found`}
                    emptyDescription="Reservations will appear here as passengers book and queue activity changes."
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
