'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Activity, Search, ShieldAlert, Star, Users } from 'lucide-react';
import { AppHeader } from '@/components/app-header';
import { PageHeader } from '@/components/admin/page-header';
import { AdminSubnavRail } from '@/components/admin/subnav-rail';
import { SummaryStrip } from '@/components/admin/summary-strip';
import { TableSurface } from '@/components/admin/table-surface';
import { PageHeaderSkeleton, StatsCardsSkeleton, TableCardSkeleton } from '@/components/dashboard/loading-skeletons';
import { InlineErrorState } from '@/components/page-state';
import { SidebarLayout } from '@/components/sidebar-layout';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DataTable } from '@/components/data-table';
import { Input } from '@/components/ui/input';
import {
  computeAdminDriverStats,
  filterAdminDriversBySource,
  getAdminDriverListHref,
  isOperationalDriverOnline,
  matchesAdminDriverSearch,
  type AdminDriverListSource,
} from '@/lib/admin-driver-management';
import { getAdminSidebarItems } from '@/lib/admin-navigation';
import { getAdminDriversData, updateAdminDriverVerification, type AdminDriversData } from '@/lib/dashboard/client';
import { useStore } from '@/lib/store-context';
import { cn } from '@/lib/utils';

type DriverRow = AdminDriversData['drivers'][number] & {
  completedRides: number;
  isOnline: boolean;
};

const numberFormatter = new Intl.NumberFormat('en-PH');
const fallbackDateTimeFormatter = new Intl.DateTimeFormat('en-PH', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
});
const relativeTimeFormatter = new Intl.RelativeTimeFormat('en', {
  numeric: 'auto',
});

function formatRelativeTime(value: string | Date | null) {
  if (!value) {
    return 'no heartbeat yet';
  }

  const date = new Date(value);
  const deltaMinutes = Math.round((date.getTime() - Date.now()) / 60000);

  if (Math.abs(deltaMinutes) < 60) {
    return relativeTimeFormatter.format(deltaMinutes, 'minute');
  }

  const deltaHours = Math.round(deltaMinutes / 60);
  if (Math.abs(deltaHours) < 24) {
    return relativeTimeFormatter.format(deltaHours, 'hour');
  }

  const deltaDays = Math.round(deltaHours / 24);
  if (Math.abs(deltaDays) < 7) {
    return relativeTimeFormatter.format(deltaDays, 'day');
  }

  return fallbackDateTimeFormatter.format(date);
}

function formatCompletedRideCount(value: number) {
  return `${numberFormatter.format(value)} completed ${value === 1 ? 'trip' : 'trips'}`;
}

function renderRatingBadge(rating: number | null) {
  if (rating == null) {
    return (
      <Badge variant="outline" className="border-slate-200 bg-slate-50 text-slate-600">
        <Star className="h-3 w-3" />
        No rating
      </Badge>
    );
  }

  return (
    <Badge className="border-amber-200 bg-amber-100 text-amber-800">
      <Star className="h-3 w-3 fill-current" />
      {rating.toFixed(1)}
    </Badge>
  );
}

function buildStatusDetail(driver: DriverRow, source: AdminDriverListSource) {
  if (source === 'unverified') {
    return 'Awaiting admin approval before the driver can go on duty.';
  }

  if (driver.isDriverRestricted) {
    return 'Driver is blocked from going on duty until reinstated.';
  }

  if (driver.isOnline) {
    return `Live since ${formatRelativeTime(driver.DriverPresence?.onlineSinceAt ?? driver.DriverPresence?.lastHeartbeatAt ?? null)}`;
  }

  return `Last heartbeat ${formatRelativeTime(driver.DriverPresence?.lastHeartbeatAt ?? null)}`;
}

export function AdminDriverDirectory({ source }: { source: AdminDriverListSource }) {
  const { currentUser, currentTenant } = useStore();
  const [data, setData] = useState<AdminDriversData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [updatingDriverId, setUpdatingDriverId] = useState<string | null>(null);
  const loadingRef = useRef(false);

  const canLoad = currentUser?.role === 'admin' && Boolean(currentTenant);

  const loadData = useCallback(async () => {
    if (!canLoad || loadingRef.current) return;
    loadingRef.current = true;
    try {
      const response = await getAdminDriversData();
      setData(response);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load drivers.');
    } finally {
      loadingRef.current = false;
      setLoading(false);
    }
  }, [canLoad]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  if (!currentUser || currentUser.role !== 'admin' || !currentTenant) {
    return (
      <div className="space-y-6 p-6">
        <PageHeaderSkeleton />
        <StatsCardsSkeleton count={4} className="md:grid-cols-2 xl:grid-cols-4" />
      </div>
    );
  }

  const drivers = data?.drivers ?? [];
  const stats = data?.stats ?? {
    totalDrivers: 0,
    verifiedDrivers: 0,
    pendingVerification: 0,
    restrictedDrivers: 0,
    activeToday: 0,
    averageRating: 0,
  };

  const driverRows = useMemo<DriverRow[]>(
    () =>
      drivers.map((driver) => ({
        ...driver,
        completedRides: driver.completedRides ?? 0,
        isOnline: isOperationalDriverOnline(driver),
      })),
    [drivers]
  );

  const sourceRows = useMemo(() => filterAdminDriversBySource(driverRows, source), [driverRows, source]);
  const filteredRows = useMemo(
    () => sourceRows.filter((driver) => matchesAdminDriverSearch(driver, searchQuery)),
    [searchQuery, sourceRows]
  );
  const sidebarItems = getAdminSidebarItems({ pendingVerificationCount: stats.pendingVerification });

  const driverTabs = [
    {
      value: 'verified' as const,
      label: 'Verified',
      count: stats.verifiedDrivers,
      description: 'Primary operating list for cleared drivers.',
    },
    {
      value: 'unverified' as const,
      label: 'Unverified',
      count: stats.pendingVerification,
      description: 'Driver applications waiting for verification review.',
    },
    {
      value: 'restricted' as const,
      label: 'Restricted',
      count: stats.restrictedDrivers,
      description: 'Drivers blocked from duty until reinstated.',
    },
  ];

  const handleVerifyDriver = async (driverId: string) => {
    if (source !== 'unverified' || updatingDriverId) return;

    setUpdatingDriverId(driverId);
    setError(null);

    try {
      await updateAdminDriverVerification(driverId, { isDriverVerified: true });
      setData((prev) => {
        if (!prev) return prev;

        const nextDrivers = prev.drivers.map((driver) =>
          driver.id === driverId
            ? {
                ...driver,
                isDriverVerified: true,
                isDriverRestricted: false,
                DriverPresence: driver.DriverPresence
                  ? { ...driver.DriverPresence, isOnline: false, onlineSinceAt: null }
                  : null,
              }
            : driver
        );

        return {
          ...prev,
          drivers: nextDrivers,
          stats: computeAdminDriverStats(nextDrivers),
        };
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to verify driver.');
    } finally {
      setUpdatingDriverId(null);
    }
  };

  const columns = [
    {
      key: 'name' as const,
      label: source === 'unverified' ? 'Applicant' : 'Driver',
      render: (value: string, row: DriverRow) => (
        <div className="min-w-0 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-medium text-foreground">{value}</span>
            {renderRatingBadge(row.rating)}
          </div>

          <div className="text-xs text-muted-foreground">
            <p className="break-all">
              {row.phone ?? 'No phone on file'}
              {' | '}
              {row.email ?? 'No email on file'}
            </p>
            <p>{row.todaName ? `TODA: ${row.todaName}` : 'No TODA assignment'}</p>
          </div>
        </div>
      ),
    },
    {
      key: 'completedRides' as const,
      label: 'Performance',
      render: (value: number) => <p className="text-sm font-medium text-foreground">{formatCompletedRideCount(value)}</p>,
    },
    {
      key: 'DriverPresence' as const,
      label: 'Status',
      render: (_value: DriverRow['DriverPresence'], row: DriverRow) => (
        <div className="space-y-1.5">
          <p
            className={cn(
              'text-sm font-medium',
              row.isDriverRestricted ? 'text-amber-900' : row.isOnline ? 'text-emerald-700' : 'text-foreground'
            )}
          >
            {source === 'unverified'
              ? 'Pending approval'
              : row.isDriverRestricted
                ? 'Restricted by admin'
                : row.isOnline
                  ? 'Currently active'
                  : 'Not on duty'}
          </p>
          <p className="text-xs text-muted-foreground">{buildStatusDetail(row, source)}</p>
        </div>
      ),
    },
    {
      key: 'id' as const,
      label: 'Actions',
      className: 'w-[220px] text-right',
      render: (value: string, row: DriverRow) => (
        <div className="flex justify-end gap-2">
          <Button type="button" size="sm" variant="outline" asChild>
            <Link href={`/admin/drivers/${value}?source=${source}`}>
              {source === 'unverified' ? 'Review' : 'View'}
            </Link>
          </Button>
          {source === 'unverified' ? (
            <Button
              type="button"
              size="sm"
              disabled={updatingDriverId === row.id}
              onClick={() => void handleVerifyDriver(row.id)}
            >
              {updatingDriverId === row.id ? 'Saving...' : 'Verify'}
            </Button>
          ) : null}
        </div>
      ),
    },
  ];

  const isVerifiedPage = source === 'verified';
  const isUnverifiedPage = source === 'unverified';
  const isRestrictedPage = source === 'restricted';
  const activeTab = driverTabs.find((tab) => tab.value === source) ?? driverTabs[0];
  const searchPlaceholder = isVerifiedPage
    ? 'Search verified drivers by name, phone, email, or driver ID'
    : isRestrictedPage
      ? 'Search restricted drivers by name, phone, email, or driver ID'
      : 'Search unverified drivers by name, phone, email, or driver ID';
  const filteredCountLabel =
    searchQuery.trim().length > 0
      ? `Showing ${filteredRows.length} of ${sourceRows.length} ${activeTab.label.toLowerCase()} drivers`
      : `Showing ${filteredRows.length} ${activeTab.label.toLowerCase()} drivers`;

  return (
    <>
      <AppHeader />
      <div className="max-w-7xl mx-auto px-4 pb-8">
        <SidebarLayout title="Admin Menu" items={sidebarItems} activeHref="/admin/drivers">
          <div className="space-y-6">
            {loading ? (
              <>
                <PageHeaderSkeleton />
                <StatsCardsSkeleton count={4} className="md:grid-cols-2 xl:grid-cols-4" />
                <TableCardSkeleton columnCount={4} rowCount={8} />
              </>
            ) : (
              <>
                <PageHeader
                  eyebrow="Driver Operations"
                  title="Drivers"
                  description={`Manage verified, unverified, and restricted drivers for ${currentTenant.name} from one review workspace.`}
                />

                {error ? (
                  <InlineErrorState
                    message={error}
                    onRetry={() => void loadData()}
                    retryLabel={isUnverifiedPage ? 'Retry unverified drivers' : isRestrictedPage ? 'Retry restricted drivers' : 'Retry verified drivers'}
                  />
                ) : null}

                <SummaryStrip
                  items={[
                    { label: 'Verified', value: stats.verifiedDrivers },
                    { label: 'Unverified', value: stats.pendingVerification },
                    { label: 'Restricted', value: stats.restrictedDrivers },
                    { label: 'Online Now', value: stats.activeToday, icon: <Activity className="h-5 w-5" /> },
                    {
                      label: `${activeTab.label} List`,
                      value: sourceRows.length,
                      icon: isUnverifiedPage || isRestrictedPage ? <ShieldAlert className="h-5 w-5" /> : <Users className="h-5 w-5" />,
                      emphasized: true,
                    },
                  ]}
                  className="md:grid-cols-2 xl:grid-cols-5"
                />
              </>
            )}
            {!loading ? (
              <div className="grid gap-6 lg:grid-cols-[240px_minmax(0,1fr)]">
                <aside className="space-y-4 pt-1">
                  <AdminSubnavRail
                    title="Driver Queues"
                    items={driverTabs.map((tab) => ({
                      key: tab.value,
                      active: tab.value === source,
                      href: getAdminDriverListHref(tab.value),
                      label: tab.label,
                      badge: tab.count,
                      description: tab.description,
                    }))}
                  />
                </aside>

                <TableSurface
                  title={`${activeTab.label} Drivers`}
                  description={
                    isVerifiedPage
                      ? 'Only verified drivers who are currently cleared to operate are shown here.'
                      : isUnverifiedPage
                        ? 'Open a driver to review the submitted profile and verify the account.'
                        : 'Restricted drivers stay here until an admin reinstates them.'
                  }
                  actions={
                    <div className="w-full lg:max-w-md">
                      <div className="relative">
                        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                        <Input
                          value={searchQuery}
                          onChange={(event) => setSearchQuery(event.target.value)}
                          placeholder={searchPlaceholder}
                          className="pl-9"
                        />
                      </div>
                      <p className="mt-2 text-xs text-muted-foreground">{filteredCountLabel}</p>
                    </div>
                  }
                  bodyClassName="pt-0"
                >
                  <DataTable
                    data={filteredRows}
                    columns={columns}
                    isLoading={loading}
                    embedded
                    emptyTitle={
                      searchQuery.trim().length > 0
                        ? `No ${activeTab.label.toLowerCase()} drivers match this search`
                        : `No ${activeTab.label.toLowerCase()} drivers found`
                    }
                    emptyDescription={
                      searchQuery.trim().length > 0
                        ? 'Try a different name, phone number, email, or driver ID.'
                        : isVerifiedPage
                          ? 'Verified drivers will appear here once approved and not restricted.'
                          : isUnverifiedPage
                            ? 'New driver applications will appear here for review.'
                            : 'Restricted drivers will appear here after an admin restriction is applied.'
                    }
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
