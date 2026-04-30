'use client';

import Link from 'next/link';
import { useParams, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Activity, ArrowLeft, Circle, Clock3, ShieldAlert, Star } from 'lucide-react';
import { AppHeader } from '@/components/app-header';
import { PageHeader } from '@/components/admin/page-header';
import { AdminSubnavRail } from '@/components/admin/subnav-rail';
import { TableSurface } from '@/components/admin/table-surface';
import { DriverProfileDetailGroup } from '@/components/admin/driver-profile-detail-group';
import { DriverTripHistory } from '@/components/admin/driver-trip-history';
import { ListCardSkeleton, PageHeaderSkeleton, StatsCardsSkeleton } from '@/components/dashboard/loading-skeletons';
import { InlineErrorState } from '@/components/page-state';
import { SidebarLayout } from '@/components/sidebar-layout';
import { StatusBadge } from '@/components/status-badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import {
  getAdminDriverListHref,
  normalizeAdminDriverListSource,
  type AdminDriverListSource,
} from '@/lib/admin-driver-management';
import { getAdminSidebarItems } from '@/lib/admin-navigation';
import { resolveDriverProfileStatus } from '@/lib/dashboard/driver-profile';
import {
  getAdminDriverProfile,
  type AdminDriverProfileData,
  updateAdminDriverRestriction,
  updateAdminDriverVerification,
} from '@/lib/dashboard/client';
import { useStore } from '@/lib/store-context';
import { cn } from '@/lib/utils';

function formatCurrency(value: number) {
  return new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: 'PHP',
    maximumFractionDigits: 0,
  }).format(value);
}

function formatDate(value: string | Date) {
  return new Date(value).toLocaleDateString();
}

function formatDateTime(value: string | Date | null, fallback = 'N/A') {
  if (!value) return fallback;
  return new Date(value).toLocaleString();
}

function getInitials(name: string) {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
}

function formatDocumentType(value: string) {
  return value
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function formatDecisionLabel(value: string) {
  return value
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function resolveDetailSource(
  driver: Pick<AdminDriverProfileData['driver'], 'isDriverVerified' | 'isDriverRestricted'> | null,
  fallbackSource: AdminDriverListSource
): AdminDriverListSource {
  if (!driver) return fallbackSource;
  if (!driver.isDriverVerified) return 'unverified';
  if (driver.isDriverRestricted) return 'restricted';
  return 'verified';
}

function getBackLabel(source: AdminDriverListSource) {
  if (source === 'unverified') return 'Back to Unverified Drivers';
  if (source === 'restricted') return 'Back to Restricted Drivers';
  return 'Back to Verified Drivers';
}

type DriverActivityPanel = 'overview' | 'trip-history' | 'earnings';

function getProfileStatusBadge(status: ReturnType<typeof resolveDriverProfileStatus>) {
  if (status === 'pending') {
    return {
      label: 'Pending Review',
      className: 'border-orange-200 bg-orange-100 text-orange-800',
      icon: <Clock3 className="h-3 w-3" />,
    };
  }

  if (status === 'restricted') {
    return {
      label: 'Restricted',
      className: 'border-amber-200 bg-amber-100 text-amber-900',
      icon: <ShieldAlert className="h-3 w-3" />,
    };
  }

  if (status === 'on-duty') {
    return {
      label: 'Online',
      className: 'border-emerald-200 bg-emerald-100 text-emerald-800',
      icon: <Activity className="h-3 w-3" />,
    };
  }

  return {
    label: 'Offline',
    className: 'border-slate-200 bg-slate-50 text-slate-700',
    icon: <Circle className="h-3 w-3 fill-current" />,
  };
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

function DriverProfileIdentitySkeleton() {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="space-y-5">
          <div className="flex items-start gap-4">
            <Skeleton className="h-20 w-20 rounded-full" />
            <div className="min-w-0 flex-1 space-y-2">
              <Skeleton className="h-7 w-40 max-w-full" />
              <Skeleton className="h-4 w-28" />
              <div className="flex flex-wrap gap-2 pt-1">
                <Skeleton className="h-6 w-20 rounded-full" />
                <Skeleton className="h-6 w-28 rounded-full" />
              </div>
            </div>
          </div>
          <Skeleton className="h-10 w-full rounded-md" />
        </div>
      </CardContent>
    </Card>
  );
}

function StatTile({
  label,
  value,
  description,
  emphasized = false,
}: {
  label: string;
  value: string | number;
  description: string;
  emphasized?: boolean;
}) {
  return (
    <Card className={cn('gap-0', emphasized && 'border-primary/20 bg-gradient-to-br from-primary/10 to-secondary/10')}>
      <CardContent className="space-y-2 pt-5">
        <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">{label}</p>
        <p className={cn('text-3xl font-bold text-foreground', emphasized && 'text-primary')}>{value}</p>
        <p className="text-sm text-muted-foreground">{description}</p>
      </CardContent>
    </Card>
  );
}

function DriverDocumentsTable({
  documents,
  title,
  description,
}: {
  documents: AdminDriverProfileData['documents'];
  title: string;
  description: string;
}) {
  return (
    <TableSurface title={title} description={description} bodyClassName="pt-0">
      {documents.length === 0 ? (
        <div className="py-8 text-sm text-muted-foreground">
          No driver documents or metadata were submitted with this application.
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Type</TableHead>
              <TableHead>Review</TableHead>
              <TableHead>Submitted</TableHead>
              <TableHead>Reviewed By</TableHead>
              <TableHead>Notes</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {documents.map((document) => (
              <TableRow key={document.id}>
                <TableCell className="font-medium">{formatDocumentType(document.documentType)}</TableCell>
                <TableCell>{formatDecisionLabel(document.reviewStatus)}</TableCell>
                <TableCell>{formatDateTime(document.submittedAt)}</TableCell>
                <TableCell>{document.reviewedBy?.name ?? 'Pending review'}</TableCell>
                <TableCell className="max-w-[320px] whitespace-normal text-sm text-muted-foreground">
                  {document.remarks ??
                    (document.fileUrl
                      ? 'File reference available.'
                      : 'Metadata only. File upload is not enabled yet.')}
                </TableCell>
                <TableCell className="text-right">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled
                    title="Document viewer coming soon."
                  >
                    View
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </TableSurface>
  );
}

export default function AdminDriverProfilePage() {
  const params = useParams<{ driverId: string }>();
  const searchParams = useSearchParams();
  const driverIdParam = params?.driverId;
  const driverId = Array.isArray(driverIdParam) ? driverIdParam[0] : driverIdParam ?? '';
  const source = normalizeAdminDriverListSource(searchParams.get('source'));
  const { currentUser, currentTenant } = useStore();
  const [data, setData] = useState<AdminDriverProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updatingAction, setUpdatingAction] = useState<'verify' | 'restrict' | 'reinstate' | null>(
    null
  );
  const [isRestrictionDialogOpen, setIsRestrictionDialogOpen] = useState(false);
  const [restrictionReason, setRestrictionReason] = useState('');
  const [activeActivityPanel, setActiveActivityPanel] = useState<DriverActivityPanel>('overview');
  const loadingRef = useRef(false);

  const canLoad = currentUser?.role === 'admin' && Boolean(currentTenant) && Boolean(driverId);
  const sidebarItems = getAdminSidebarItems();

  const loadData = useCallback(async () => {
    if (!canLoad || loadingRef.current) return;

    loadingRef.current = true;
    try {
      const response = await getAdminDriverProfile(driverId);
      setData(response);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load driver details.');
    } finally {
      loadingRef.current = false;
      setLoading(false);
    }
  }, [canLoad, driverId]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const handleVerifyDriver = async () => {
    if (!data || updatingAction) return;

    setUpdatingAction('verify');
    setError(null);

    try {
      await updateAdminDriverVerification(data.driver.id, { isDriverVerified: true });
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to verify driver.');
    } finally {
      setUpdatingAction(null);
    }
  };

  const handleRestrictDriver = async () => {
    if (!data || updatingAction) return;

    setUpdatingAction('restrict');
    setError(null);

    try {
      await updateAdminDriverRestriction(data.driver.id, {
        isDriverRestricted: true,
        reason: restrictionReason,
      });
      setIsRestrictionDialogOpen(false);
      setRestrictionReason('');
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to restrict driver.');
    } finally {
      setUpdatingAction(null);
    }
  };

  const handleReinstateDriver = async () => {
    if (!data || updatingAction) return;

    setUpdatingAction('reinstate');
    setError(null);

    try {
      await updateAdminDriverRestriction(data.driver.id, {
        isDriverRestricted: false,
      });
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reinstate driver.');
    } finally {
      setUpdatingAction(null);
    }
  };

  if (!currentUser || currentUser.role !== 'admin' || !currentTenant) {
    return (
      <div className="space-y-6 p-6">
        <PageHeaderSkeleton withAction />
        <StatsCardsSkeleton count={4} className="md:grid-cols-2 xl:grid-cols-4" />
        <ListCardSkeleton itemCount={6} />
      </div>
    );
  }

  const driver = data?.driver ?? null;
  const presence = data?.presence ?? {
    isOnline: false,
    onlineSinceAt: null,
    lastHeartbeatAt: null,
  };
  const activeRide = data?.activeRide ?? null;
  const stats = data?.stats ?? {
    totalTrips: 0,
    completedTrips: 0,
    cancelledTrips: 0,
    activeTrips: 0,
    totalEarnings: 0,
    averageCompletedFare: 0,
    completionRate: 0,
  };
  const recentRides = data?.recentRides ?? [];
  const documents = data?.documents ?? [];
  const detailSource = resolveDetailSource(driver, source);
  const activeHref = getAdminDriverListHref(detailSource);
  const backLabel = getBackLabel(detailSource);

  if (loading) {
    return (
      <>
        <AppHeader />
        <div className="mx-auto max-w-7xl px-4 pb-8">
          <SidebarLayout title="Admin Menu" items={sidebarItems} activeHref={getAdminDriverListHref(source)}>
            <div className="space-y-6">
              <PageHeaderSkeleton withAction />
              <div className="grid gap-6 xl:grid-cols-[320px_minmax(0,1fr)]">
                <div className="space-y-4">
                  <DriverProfileIdentitySkeleton />
                  <ListCardSkeleton itemCount={6} />
                </div>
                <div className="space-y-4">
                  <StatsCardsSkeleton count={4} className="md:grid-cols-2 xl:grid-cols-4" />
                  <ListCardSkeleton itemCount={6} />
                </div>
              </div>
            </div>
          </SidebarLayout>
        </div>
      </>
    );
  }

  if (!driver) {
    return (
      <>
        <AppHeader />
        <div className="mx-auto max-w-7xl px-4 pb-8">
          <SidebarLayout title="Admin Menu" items={sidebarItems} activeHref={getAdminDriverListHref(source)}>
            <InlineErrorState
              message={error ?? 'Driver details were not found.'}
              onRetry={() => void loadData()}
              retryLabel="Retry driver details"
            />
          </SidebarLayout>
        </div>
      </>
    );
  }

  const isUnverifiedDriver = !driver.isDriverVerified;
  const completedRideRows = recentRides.filter((ride) => ride.status === 'completed');
  const profileStatus = resolveDriverProfileStatus({
    isDriverVerified: driver.isDriverVerified,
    isDriverRestricted: driver.isDriverRestricted,
    isOnline: presence.isOnline,
  });
  const profileStatusBadge = getProfileStatusBadge(profileStatus);
  const restrictionActionDisabled = updatingAction !== null || Boolean(activeRide);
  const latestActivity = recentRides[0] ? formatDate(recentRides[0].createdAt) : 'No rides yet';

  const personalInfoItems = [
    { label: 'Phone', value: driver.phone ?? 'Not provided' },
    { label: 'Email', value: driver.email ?? 'Not provided' },
    { label: 'Date of Birth', value: formatDateTime(driver.dateOfBirth, 'Not provided') },
    { label: 'Home Address', value: driver.homeAddress ?? 'Not provided' },
    { label: 'Registered', value: formatDate(driver.createdAt) },
  ];

  const todaAssignmentItems = [
    {
      label: 'Assigned TODA',
      value: driver.toda ? `${driver.toda.name} - ${driver.toda.location}` : 'No TODA assigned',
    },
    { label: 'Membership ID', value: driver.todaMembershipId ?? 'Not provided' },
  ];

  const reviewSummaryItems = [
    {
      label: 'Verification Status',
      value: driver.verificationStatus === 'verified' ? 'Verified' : 'Pending Review',
    },
    { label: 'Documents Submitted', value: `${documents.length}` },
    {
      label: 'Documents Reviewed',
      value: `${documents.filter((document) => document.reviewedAt || document.reviewStatus !== 'submitted').length}`,
    },
    {
      label: 'Still Pending',
      value: `${documents.filter((document) => !document.reviewedAt && document.reviewStatus === 'submitted').length}`,
    },
  ];

  const restrictionInfoItems = driver.isDriverRestricted
    ? [
        { label: 'Reason', value: driver.driverRestrictionReason ?? 'No reason provided' },
        {
          label: 'Restricted At',
          value: formatDateTime(driver.driverRestrictedAt, 'Restriction time unavailable'),
        },
      ]
    : [];

  const profileItems = [
    { label: 'Legal Name', value: driver.legalFullName ?? driver.name },
    { label: 'License Number', value: driver.licenseNumber ?? 'Not provided' },
    { label: 'License Expiry', value: formatDateTime(driver.licenseExpiry, 'Not provided') },
    { label: 'Vehicle Type', value: driver.vehicleType ?? 'Not provided' },
    { label: 'Plate Number', value: driver.plateNumber ?? 'Not provided' },
    { label: 'Vehicle Model', value: driver.vehicleModel ?? 'Not provided' },
    { label: 'Vehicle Color', value: driver.vehicleColor ?? 'Not provided' },
  ];

  const presenceItems = [
    { label: 'Online Since', value: formatDateTime(presence.onlineSinceAt, 'Not currently online') },
    { label: 'Last Heartbeat', value: formatDateTime(presence.lastHeartbeatAt, 'No heartbeat recorded') },
  ];

  const performanceItems = [
    { label: 'Completion Rate', value: `${stats.completionRate.toFixed(1)}%` },
    { label: 'Average Completed Fare', value: formatCurrency(stats.averageCompletedFare) },
    { label: 'Latest Activity', value: latestActivity },
  ];

  const activeRideItems = activeRide
    ? [
        { label: 'Route', value: `${activeRide.pickupLocation} to ${activeRide.dropoffLocation}` },
        {
          label: 'Passenger',
          value: activeRide.passenger.phone
            ? `${activeRide.passenger.name} (${activeRide.passenger.phone})`
            : activeRide.passenger.name,
        },
        {
          label: 'Terminal',
          value: activeRide.terminal
            ? `${activeRide.terminal.name} - ${activeRide.terminal.location}`
            : 'No terminal assigned',
        },
        { label: 'Status', value: <StatusBadge status={activeRide.status} /> },
      ]
    : [];

  const unverifiedDescription = `Review ${driver.name}'s submitted profile and documents before approving the account.`;
  const operationalDescription = driver.isDriverRestricted
    ? `Operational view for ${driver.name}. This driver is currently restricted.`
    : `Operational view for ${driver.name}.`;
  const activityPanels = [
    {
      key: 'overview' as const,
      label: 'Overview',
      description: 'Presence, performance, and live assignment details for this driver.',
    },
    {
      key: 'trip-history' as const,
      label: 'Trip History',
      description: 'Recent ride records handled by this driver across active and completed work.',
      badge: recentRides.length,
    },
    {
      key: 'earnings' as const,
      label: 'Earnings',
      description: 'Completed-fare totals and earning history tied to finished rides.',
      badge: stats.completedTrips,
    },
  ];
  const activeActivityPanelConfig =
    activityPanels.find((panel) => panel.key === activeActivityPanel) ?? activityPanels[0];

  return (
    <>
      <AppHeader />
      <div className="mx-auto max-w-7xl px-4 pb-8">
        <SidebarLayout title="Admin Menu" items={sidebarItems} activeHref={activeHref}>
          <div className="space-y-6">
            <PageHeader
              eyebrow={isUnverifiedDriver ? 'Driver Verification' : 'Driver Detail'}
              title={isUnverifiedDriver ? 'Driver Review' : 'Driver Profile'}
              description={isUnverifiedDriver ? unverifiedDescription : operationalDescription}
              actions={
                <Button variant="outline" asChild>
                  <Link href={activeHref}>
                    <ArrowLeft className="h-4 w-4" />
                    {backLabel}
                  </Link>
                </Button>
              }
            />

            {error ? (
              <InlineErrorState
                message={error}
                onRetry={() => void loadData()}
                retryLabel="Retry driver details"
              />
            ) : null}

            <div className="grid gap-6 xl:grid-cols-[320px_minmax(0,1fr)]">
              <div className="space-y-4">
                <Card>
                  <CardContent className="pt-6">
                    <div className="space-y-5">
                      <div className="flex items-start gap-4">
                        <Avatar className="h-20 w-20 border border-border">
                          <AvatarImage src={driver.avatar ?? ''} alt={driver.name} />
                          <AvatarFallback>{getInitials(driver.name)}</AvatarFallback>
                        </Avatar>

                        <div className="min-w-0 flex-1 space-y-3">
                          <div className="space-y-1">
                            <p className="truncate text-xl font-bold text-foreground">{driver.name}</p>
                            <p className="text-xs text-muted-foreground">Driver ID: {driver.id}</p>
                          </div>

                          <div className="flex flex-wrap gap-2">
                            <Badge className={profileStatusBadge.className}>
                              {profileStatusBadge.icon}
                              {profileStatusBadge.label}
                            </Badge>
                            {renderRatingBadge(driver.rating)}
                          </div>
                        </div>
                      </div>

                      {!driver.isDriverVerified ? (
                        <div className="space-y-2">
                          <Button
                            type="button"
                            className="w-full"
                            disabled={updatingAction !== null}
                            onClick={() => void handleVerifyDriver()}
                          >
                            {updatingAction === 'verify' ? 'Saving...' : 'Verify Driver'}
                          </Button>
                          <p className="text-xs text-muted-foreground">
                            Verify this account once the submitted identity, TODA assignment, and
                            vehicle details are complete.
                          </p>
                        </div>
                      ) : driver.isDriverRestricted ? (
                        <div className="space-y-2">
                          <Button
                            type="button"
                            className="w-full"
                            disabled={updatingAction !== null}
                            onClick={() => void handleReinstateDriver()}
                          >
                            {updatingAction === 'reinstate' ? 'Saving...' : 'Reinstate Driver'}
                          </Button>
                          <p className="text-xs text-muted-foreground">
                            Reinstating restores dashboard access after the restriction is cleared.
                          </p>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          <Button
                            type="button"
                            variant="destructive"
                            className="w-full"
                            disabled={restrictionActionDisabled}
                            onClick={() => {
                              setRestrictionReason(driver.driverRestrictionReason ?? '');
                              setIsRestrictionDialogOpen(true);
                            }}
                          >
                            {updatingAction === 'restrict' ? 'Saving...' : 'Restrict Driver'}
                          </Button>
                          <p className="text-xs text-muted-foreground">
                            {activeRide
                              ? 'Restriction is blocked while the driver has an active ride.'
                              : 'Restricting forces the driver offline and blocks operational access until reinstated.'}
                          </p>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>

                {driver.isDriverRestricted ? (
                  <Card className="border-amber-200 bg-amber-50/70">
                    <CardContent className="pt-6">
                      <DriverProfileDetailGroup title="Restriction Details" items={restrictionInfoItems} />
                    </CardContent>
                  </Card>
                ) : null}

                <div className="overflow-hidden rounded-2xl border border-primary/26 bg-muted">
                  <div className="p-5">
                    <DriverProfileDetailGroup
                      title={isUnverifiedDriver ? 'Applicant Details' : 'Personal Information'}
                      description={
                        isUnverifiedDriver
                          ? 'Core identity and contact details used during driver review.'
                          : undefined
                      }
                      items={personalInfoItems}
                    />
                  </div>
                </div>

                <div className="overflow-hidden rounded-2xl border border-primary/26 bg-muted">
                  <div className="p-5">
                    <DriverProfileDetailGroup
                      title={isUnverifiedDriver ? 'License And Vehicle' : 'Driver Profile'}
                      description={
                        isUnverifiedDriver
                          ? 'Check these details against the submitted driver documents.'
                          : undefined
                      }
                      items={profileItems}
                      columns={2}
                    />
                  </div>
                </div>

                <div className="overflow-hidden rounded-2xl border border-primary/26 bg-muted">
                  <div className="p-5">
                    <DriverProfileDetailGroup
                      title="TODA Assignment"
                      description={
                        isUnverifiedDriver
                          ? 'Make sure the driver is assigned to the correct Tuguegarao terminal.'
                          : undefined
                      }
                      items={todaAssignmentItems}
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                {isUnverifiedDriver ? (
                  <>
                    <Card className="border-primary/20 bg-primary/5">
                      <CardContent className="pt-6">
                        <DriverProfileDetailGroup
                          title="Review Summary"
                          description="Use this summary to confirm whether the application is complete enough to approve."
                          items={reviewSummaryItems}
                          columns={2}
                        />
                      </CardContent>
                    </Card>

                    <DriverDocumentsTable
                      documents={documents}
                      title="Submitted Documents"
                      description="Review the files and metadata tied to this application before verifying the driver."
                    />
                  </>
                ) : (
                  <>
                    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                      <StatTile
                        label="Total Trips"
                        value={stats.totalTrips}
                        description={`Active now: ${stats.activeTrips}`}
                      />
                      <StatTile
                        label="Completed"
                        value={stats.completedTrips}
                        description={`Completion rate: ${stats.completionRate.toFixed(1)}%`}
                      />
                      <StatTile
                        label="Cancelled"
                        value={stats.cancelledTrips}
                        description="Historical cancellations"
                      />
                      <StatTile
                        label="Total Earnings"
                        value={formatCurrency(stats.totalEarnings)}
                        description={`Avg fare: ${formatCurrency(stats.averageCompletedFare)}`}
                        emphasized
                      />
                    </div>

                    <div className="overflow-hidden rounded-2xl border border-primary/25 bg-muted">
                      <div className="grid gap-0 lg:grid-cols-[240px_minmax(0,1fr)]">
                        <aside className="border-b border-border/60 bg-background/18 p-5 lg:border-b-0 lg:border-r">
                          <AdminSubnavRail
                            title="Driver Activity"
                            items={activityPanels.map((panel) => ({
                              key: panel.key,
                              label: panel.label,
                              description: panel.description,
                              badge: panel.badge,
                              active: panel.key === activeActivityPanel,
                              onClick: () => setActiveActivityPanel(panel.key),
                            }))}
                          />
                        </aside>

                        <div className="px-6 py-6">
                          <div className="mb-6 space-y-1">
                            <h2 className="text-lg font-semibold text-foreground">
                              {activeActivityPanelConfig.label}
                            </h2>
                            <p className="text-sm text-muted-foreground">
                              {activeActivityPanelConfig.description}
                            </p>
                          </div>

                          {activeActivityPanel === 'overview' ? (
                          <div className="grid gap-6 xl:grid-cols-2">
                            <div className="rounded-xl border border-border/50 bg-background/15 p-5">
                              <DriverProfileDetailGroup title="Presence" items={presenceItems} />
                            </div>

                            <div className="rounded-xl border border-border/50 bg-background/15 p-5">
                              <DriverProfileDetailGroup title="Performance" items={performanceItems} />
                            </div>

                            <div className="rounded-xl border border-border/50 bg-background/15 p-5 xl:col-span-2">
                              <DriverProfileDetailGroup
                                title="Active Ride"
                                items={activeRideItems}
                                columns={2}
                                emptyState="No active ride assignment."
                              />
                            </div>
                          </div>
                          ) : null}

                          {activeActivityPanel === 'trip-history' ? (
                          <DriverTripHistory rides={recentRides} />
                          ) : null}

                          {activeActivityPanel === 'earnings' ? (
                          <div className="space-y-5">
                            <div className="grid overflow-hidden rounded-xl border border-border/60 bg-background/15 md:grid-cols-3">
                              <div className="border-b border-border/60 p-4 md:border-b-0 md:border-r">
                                <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                                  Completed Trips
                                </p>
                                <p className="mt-2 text-2xl font-bold text-foreground">
                                  {stats.completedTrips}
                                </p>
                              </div>
                              <div className="border-b border-border/60 p-4 md:border-b-0 md:border-r">
                                <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                                  Average Fare
                                </p>
                                <p className="mt-2 text-2xl font-bold text-foreground">
                                  {formatCurrency(stats.averageCompletedFare)}
                                </p>
                              </div>
                              <div className="p-4">
                                <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                                  Total Earnings
                                </p>
                                <p className="mt-2 text-2xl font-bold text-primary">
                                  {formatCurrency(stats.totalEarnings)}
                                </p>
                              </div>
                            </div>

                            <div className="overflow-hidden rounded-xl border border-border/60 bg-background/15">
                              {completedRideRows.length === 0 ? (
                                <div className="flex min-h-[220px] flex-col items-center justify-center gap-1 px-4 text-center">
                                  <p className="text-sm font-medium text-foreground">No completed rides yet</p>
                                  <p className="text-sm text-muted-foreground">
                                    Earnings details appear once rides are completed.
                                  </p>
                                </div>
                              ) : (
                                <Table>
                                  <TableHeader>
                                    <TableRow>
                                      <TableHead className="whitespace-normal">Completed Route</TableHead>
                                      <TableHead>Fare</TableHead>
                                      <TableHead>Completed Date</TableHead>
                                    </TableRow>
                                  </TableHeader>
                                  <TableBody>
                                    {completedRideRows.map((ride) => (
                                      <TableRow key={ride.id}>
                                        <TableCell className="max-w-0 whitespace-normal">
                                          <div className="space-y-1">
                                            <p className="font-medium text-foreground">
                                              {ride.pickupLocation} to {ride.dropoffLocation}
                                            </p>
                                            {ride.terminal ? (
                                              <p className="text-xs text-muted-foreground">
                                                {ride.terminal.name} - {ride.terminal.location}
                                              </p>
                                            ) : null}
                                          </div>
                                        </TableCell>
                                        <TableCell className="font-medium text-primary">
                                          {formatCurrency(ride.fare)}
                                        </TableCell>
                                        <TableCell>
                                          {ride.completedAt ? formatDate(ride.completedAt) : 'N/A'}
                                        </TableCell>
                                      </TableRow>
                                    ))}
                                  </TableBody>
                                </Table>
                              )}
                            </div>
                          </div>
                          ) : null}
                        </div>
                      </div>
                    </div>

                    <DriverDocumentsTable
                      documents={documents}
                      title="Driver Documents"
                      description="Submitted onboarding records kept on file for this verified driver."
                    />
                  </>
                )}
              </div>
            </div>
          </div>
        </SidebarLayout>
      </div>

      <Dialog
        open={isRestrictionDialogOpen}
        onOpenChange={(open) => {
          setIsRestrictionDialogOpen(open);
          if (!open && updatingAction !== 'restrict') {
            setRestrictionReason('');
          }
        }}
      >
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Restrict Driver</DialogTitle>
            <DialogDescription>
              This forces the driver offline and blocks access to operational driver screens until an
              admin reinstates the account.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            <Label htmlFor="driver-restriction-reason">Restriction reason</Label>
            <Textarea
              id="driver-restriction-reason"
              value={restrictionReason}
              onChange={(event) => setRestrictionReason(event.target.value)}
              placeholder="Explain why this driver is being restricted."
              rows={5}
              maxLength={500}
            />
            <p className="text-xs text-muted-foreground">
              This reason is shown in admin tools and on the driver status screen.
            </p>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsRestrictionDialogOpen(false)}
              disabled={updatingAction === 'restrict'}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={() => void handleRestrictDriver()}
              disabled={updatingAction === 'restrict' || restrictionReason.trim().length === 0}
            >
              {updatingAction === 'restrict' ? 'Saving...' : 'Confirm Restriction'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
