'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useStore } from '@/lib/store-context';
import { AppHeader } from '@/components/app-header';
import { PageHeader } from '@/components/admin/page-header';
import { SummaryStrip } from '@/components/admin/summary-strip';
import { TableSurface } from '@/components/admin/table-surface';
import { PageHeaderSkeleton, StatsCardsSkeleton, ListCardSkeleton } from '@/components/dashboard/loading-skeletons';
import { InlineErrorState } from '@/components/page-state';
import { SidebarLayout } from '@/components/sidebar-layout';
import { Clock3, DollarSign, MapPin, TrendingUp } from 'lucide-react';
import { getAdminReportsData, type AdminReportsData } from '@/lib/dashboard/client';
import { getAdminSidebarItems } from '@/lib/admin-navigation';

function formatCurrency(value: number) {
  return new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP', maximumFractionDigits: 0 }).format(
    value
  );
}

export default function AdminReportsPage() {
  const { currentUser, currentTenant, currentTenantSettings } = useStore();
  const [data, setData] = useState<AdminReportsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const loadingRef = useRef(false);

  const canLoad = currentUser?.role === 'admin' && Boolean(currentTenant);

  const loadData = useCallback(async () => {
    if (!canLoad || loadingRef.current) return;
    loadingRef.current = true;
    try {
      const response = await getAdminReportsData();
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

  const sidebarItems = getAdminSidebarItems();

  if (!currentUser || currentUser.role !== 'admin' || !currentTenant) {
    return (
      <div className="space-y-6 p-6">
        <PageHeaderSkeleton />
        <StatsCardsSkeleton count={4} />
        <ListCardSkeleton itemCount={3} />
      </div>
    );
  }

  const stats = data?.stats ?? {
    totalRides: 0,
    completedRides: 0,
    totalFares: 0,
    commission: 0,
    completionRate: 0,
    driverActivity: 0,
    terminalOccupancy: 0,
    todayRides: 0,
  };
  const reportingPreferences = currentTenantSettings?.reportingPreferences;

  return (
    <>
      <AppHeader />
      <div className="max-w-7xl mx-auto px-4 pb-8">
        <SidebarLayout title="Admin Menu" items={sidebarItems}>
          <div className="space-y-6">
            {loading ? (
              <>
                <PageHeaderSkeleton />
                <StatsCardsSkeleton count={4} className="md:grid-cols-2 lg:grid-cols-4" />
                <ListCardSkeleton itemCount={3} />
              </>
            ) : (
              <>
                <PageHeader
                  eyebrow="Reporting"
                  title="Reports and Analytics"
                  description={`Performance metrics for ${currentTenant.name}.`}
                />

                {error ? (
                  <InlineErrorState
                    message={error}
                    onRetry={() => void loadData()}
                    retryLabel="Retry reports"
                  />
                ) : null}

                <SummaryStrip
                  items={[
                    { label: 'Total Trips', value: stats.totalRides, icon: <MapPin className="h-5 w-5" /> },
                    { label: 'Completed', value: stats.completedRides, icon: <TrendingUp className="h-5 w-5" /> },
                    { label: 'Total Fares', value: formatCurrency(stats.totalFares), icon: <DollarSign className="h-5 w-5" /> },
                    { label: 'Commission', value: formatCurrency(stats.commission), icon: <Clock3 className="h-5 w-5" />, emphasized: true },
                  ]}
                />

                <TableSurface
                  title="Performance Metrics"
                  description="Key performance indicators controlled by tenant reporting preferences."
                >
                  <div className="space-y-6">
                    {reportingPreferences?.showCompletionRate ?? true ? (
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium">Completion Rate</span>
                        <span className="text-sm font-bold">{stats.completionRate.toFixed(1)}%</span>
                      </div>
                      <div className="h-2 bg-muted rounded-full overflow-hidden">
                        <div className="h-full bg-secondary" style={{ width: `${Math.min(100, stats.completionRate)}%` }} />
                      </div>
                    </div>
                    ) : null}
                    {reportingPreferences?.showDriverActivity ?? true ? (
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium">Driver Activity</span>
                        <span className="text-sm font-bold">{stats.driverActivity.toFixed(1)}%</span>
                      </div>
                      <div className="h-2 bg-muted rounded-full overflow-hidden">
                        <div className="h-full bg-primary" style={{ width: `${Math.min(100, stats.driverActivity)}%` }} />
                      </div>
                    </div>
                    ) : null}
                    {reportingPreferences?.showTerminalOccupancy ?? true ? (
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium">Terminal Occupancy</span>
                        <span className="text-sm font-bold">{stats.terminalOccupancy.toFixed(1)}%</span>
                      </div>
                      <div className="h-2 bg-muted rounded-full overflow-hidden">
                        <div className="h-full bg-brand" style={{ width: `${Math.min(100, stats.terminalOccupancy)}%` }} />
                      </div>
                    </div>
                    ) : null}
                  </div>
                </TableSurface>
              </>
            )}
          </div>
        </SidebarLayout>
      </div>
    </>
  );
}
