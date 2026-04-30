'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useStore } from '@/lib/store-context';
import { AppHeader } from '@/components/app-header';
import { PageHeader } from '@/components/admin/page-header';
import { SummaryStrip } from '@/components/admin/summary-strip';
import { TableSurface } from '@/components/admin/table-surface';
import { MapCardSkeleton, PageHeaderSkeleton, StatsCardsSkeleton } from '@/components/dashboard/loading-skeletons';
import { InlineErrorState } from '@/components/page-state';
import { SidebarLayout } from '@/components/sidebar-layout';
import { MapView, type MapPoint } from '@/components/map-view';
import { Building2, Users, TrendingUp } from 'lucide-react';
import { getSuperadminOverviewData, type SuperadminOverviewData } from '@/lib/dashboard/client';
import { getSuperadminSidebarItems } from '@/lib/superadmin-navigation';

export default function SuperadminDashboardPage() {
  const { currentUser } = useStore();
  const [data, setData] = useState<SuperadminOverviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const loadingRef = useRef(false);

  const canLoad = currentUser?.role === 'superadmin';

  const loadData = useCallback(async () => {
    if (!canLoad || loadingRef.current) return;
    loadingRef.current = true;
    try {
      const response = await getSuperadminOverviewData();
      setData(response);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load dashboard.');
    } finally {
      loadingRef.current = false;
      setLoading(false);
    }
  }, [canLoad]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const sidebarItems = getSuperadminSidebarItems();

  if (!currentUser || currentUser.role !== 'superadmin') {
    return (
      <div className="space-y-6 p-6">
        <PageHeaderSkeleton />
        <StatsCardsSkeleton count={4} />
        <MapCardSkeleton heightClassName="h-[400px]" />
      </div>
    );
  }

  const stats = data?.stats ?? {
    totalCoverageProvinces: 0,
    totalTenants: 0,
    totalUsers: 0,
    totalRides: 0,
  };

  const platformMapPoints: MapPoint[] = (data?.platformMapPoints ?? []).map((point) => ({
    ...point,
    tone: point.tone as MapPoint['tone'],
  }));

  return (
    <>
      <AppHeader />
      <div className="max-w-7xl mx-auto px-4 pb-8">
        <SidebarLayout title="Superadmin Menu" items={sidebarItems}>
          <div className="space-y-6">
            {loading ? (
              <>
                <PageHeaderSkeleton />
                <StatsCardsSkeleton count={4} className="md:grid-cols-2 lg:grid-cols-4" />
                <MapCardSkeleton heightClassName="h-[400px]" />
              </>
            ) : (
              <>
                <PageHeader
                  eyebrow="Platform Control"
                  title="Dashboard"
                  description="Manage province-based tenants, coverage, and platform-wide operations from one shared workspace."
                />

                {error ? (
                  <InlineErrorState
                    message={error}
                    onRetry={() => void loadData()}
                    retryLabel="Retry dashboard"
                  />
                ) : null}

                <SummaryStrip
                  items={[
                    { label: 'Coverage Provinces', value: stats.totalCoverageProvinces, icon: <Building2 className="h-5 w-5" /> },
                    { label: 'Tenants', value: stats.totalTenants, icon: <Building2 className="h-5 w-5" /> },
                    { label: 'Users', value: stats.totalUsers, icon: <Users className="h-5 w-5" /> },
                    { label: 'Total Trips', value: stats.totalRides, icon: <TrendingUp className="h-5 w-5" />, emphasized: true },
                  ]}
                />

                <TableSurface
                  title="Platform Coverage Map"
                  description="Tenant terminals and live ride activity across the platform footprint."
                >
                  <MapView points={platformMapPoints} showRoute={false} height="h-[400px]" />
                </TableSurface>
              </>
            )}
          </div>
        </SidebarLayout>
      </div>
    </>
  );
}
