'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import { Search } from 'lucide-react';
import { AppHeader } from '@/components/app-header';
import { FilterBar } from '@/components/admin/filter-bar';
import { PageHeader } from '@/components/admin/page-header';
import { SummaryStrip } from '@/components/admin/summary-strip';
import { TableSurface } from '@/components/admin/table-surface';
import { InlineErrorState } from '@/components/page-state';
import { SidebarLayout } from '@/components/sidebar-layout';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PendingButtonContent } from '@/components/ui/pending-button-content';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import {
  createSuperadminTenantTerminal,
  getSuperadminTenantAuditData,
  getSuperadminTenantDetail,
  getSuperadminTenantDriversData,
  getSuperadminTenantReservationsData,
  getSuperadminTenantRidesData,
  getSuperadminTenantSettingsData,
  getSuperadminTenantTeamData,
  getSuperadminTenantTerminalsData,
  inviteSuperadminTenantTeamMember,
  type AdminDriversData,
  type AdminTenantAuditData,
  type AdminTenantTeamData,
  type AdminTerminalsData,
  type SuperadminTenantDetailData,
  type SuperadminTenantReservationsData,
  type SuperadminTenantRidesData,
  type SuperadminTenantSettingsData,
  updateSuperadminTenant,
  updateSuperadminTenantDriverRestriction,
  updateSuperadminTenantDriverVerification,
  updateSuperadminTenantSettings,
  updateSuperadminTenantTeamMember,
  updateSuperadminTenantTerminal,
} from '@/lib/dashboard/client';
import { getSuperadminSidebarItems } from '@/lib/superadmin-navigation';
import { useStore } from '@/lib/store-context';

type TenantTab =
  | 'overview'
  | 'team'
  | 'settings'
  | 'audit'
  | 'drivers'
  | 'terminals'
  | 'rides'
  | 'reservations';

function formatCurrency(value: number) {
  return new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: 'PHP',
    maximumFractionDigits: 0,
  }).format(value);
}

function formatDateTime(value: string | Date | null | undefined) {
  if (!value) return 'Unavailable';
  return new Date(value).toLocaleString();
}

function getTerminalAdjustment(settings: SuperadminTenantSettingsData['settings'], terminalId: string) {
  return (
    settings.operationsPreferences.onDemandFare.terminalAdjustments.find((item) => item.terminalId === terminalId)
      ?.amount ?? 0
  );
}

function setTerminalAdjustment(
  settings: SuperadminTenantSettingsData['settings'],
  terminalId: string,
  amount: number
) {
  const next = settings.operationsPreferences.onDemandFare.terminalAdjustments.filter(
    (item) => item.terminalId !== terminalId
  );

  if (amount !== 0) {
    next.push({ terminalId, amount });
  }

  return {
    ...settings,
    operationsPreferences: {
      ...settings.operationsPreferences,
      onDemandFare: {
        ...settings.operationsPreferences.onDemandFare,
        terminalAdjustments: next.sort((left, right) => left.terminalId.localeCompare(right.terminalId)),
      },
    },
  };
}

function matchesSearch(values: Array<string | null | undefined>, query: string) {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) return true;

  return values.some((value) => value?.toLowerCase().includes(normalizedQuery));
}

export default function SuperadminTenantDetailPage() {
  const { currentUser } = useStore();
  const params = useParams<{ tenantId: string }>();
  const tenantId = Array.isArray(params?.tenantId) ? params.tenantId[0] : params?.tenantId;
  const [activeTab, setActiveTab] = useState<TenantTab>('overview');
  const [overview, setOverview] = useState<SuperadminTenantDetailData | null>(null);
  const [teamData, setTeamData] = useState<Pick<AdminTenantTeamData, 'members' | 'roles'> | null>(null);
  const [settingsData, setSettingsData] = useState<SuperadminTenantSettingsData | null>(null);
  const [auditData, setAuditData] = useState<AdminTenantAuditData | null>(null);
  const [driversData, setDriversData] = useState<AdminDriversData | null>(null);
  const [terminalsData, setTerminalsData] = useState<AdminTerminalsData | null>(null);
  const [ridesData, setRidesData] = useState<SuperadminTenantRidesData | null>(null);
  const [reservationsData, setReservationsData] = useState<SuperadminTenantReservationsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const loadingRef = useRef(false);

  const [brandingDraft, setBrandingDraft] = useState({
    logoUrl: '',
    faviconUrl: '',
    primaryColor: '',
    accentColor: '',
    backgroundColor: '',
    foregroundColor: '',
    driverPrimaryColor: '',
    driverAccentColor: '',
    driverBackgroundColor: '',
    driverForegroundColor: '',
    reason: '',
  });
  const [lifecycleDialogOpen, setLifecycleDialogOpen] = useState(false);
  const [lifecycleReason, setLifecycleReason] = useState('');
  const [lifecycleMessage, setLifecycleMessage] = useState('');
  const [savingLifecycle, setSavingLifecycle] = useState(false);
  const [savingBranding, setSavingBranding] = useState(false);

  const [teamSearch, setTeamSearch] = useState('');
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);
  const [inviteForm, setInviteForm] = useState({
    name: '',
    email: '',
    tenantRoleKey: '',
    reason: '',
  });
  const [savingTeam, setSavingTeam] = useState(false);

  const [settingsDraft, setSettingsDraft] = useState<SuperadminTenantSettingsData['settings'] | null>(null);
  const [settingsReason, setSettingsReason] = useState('');
  const [savingSettings, setSavingSettings] = useState(false);

  const [driverSearch, setDriverSearch] = useState('');
  const [driverAction, setDriverAction] = useState<{
    driverId: string;
    name: string;
    kind: 'verify' | 'restrict' | 'reinstate';
  } | null>(null);
  const [driverReason, setDriverReason] = useState('');
  const [savingDriver, setSavingDriver] = useState(false);

  const [terminalSearch, setTerminalSearch] = useState('');
  const [terminalDialog, setTerminalDialog] = useState<{
    id?: string;
    name: string;
    location: string;
    latitude: string;
    longitude: string;
    capacity: string;
    reason: string;
  } | null>(null);
  const [savingTerminal, setSavingTerminal] = useState(false);

  const [rideSearch, setRideSearch] = useState('');
  const [reservationSearch, setReservationSearch] = useState('');

  const canLoad = currentUser?.role === 'superadmin' && Boolean(tenantId);

  const loadData = useCallback(async () => {
    if (!canLoad || !tenantId || loadingRef.current) return;
    loadingRef.current = true;

    try {
      const [
        nextOverview,
        nextTeam,
        nextSettings,
        nextAudit,
        nextDrivers,
        nextTerminals,
        nextRides,
        nextReservations,
      ] = await Promise.all([
        getSuperadminTenantDetail(tenantId),
        getSuperadminTenantTeamData(tenantId),
        getSuperadminTenantSettingsData(tenantId),
        getSuperadminTenantAuditData(tenantId),
        getSuperadminTenantDriversData(tenantId),
        getSuperadminTenantTerminalsData(tenantId),
        getSuperadminTenantRidesData(tenantId),
        getSuperadminTenantReservationsData(tenantId),
      ]);

      setOverview(nextOverview);
      setTeamData(nextTeam);
      setSettingsData(nextSettings);
      setAuditData(nextAudit);
      setDriversData(nextDrivers);
      setTerminalsData(nextTerminals);
      setRidesData(nextRides);
      setReservationsData(nextReservations);
      setSettingsDraft(nextSettings.settings);
      setBrandingDraft({
        logoUrl: nextOverview.tenant.logoUrl ?? '',
        faviconUrl: nextOverview.tenant.faviconUrl ?? '',
        primaryColor: nextOverview.tenant.primaryColor ?? '',
        accentColor: nextOverview.tenant.accentColor ?? '',
        backgroundColor: nextOverview.tenant.backgroundColor ?? '',
        foregroundColor: nextOverview.tenant.foregroundColor ?? '',
        driverPrimaryColor: nextOverview.tenant.driverPrimaryColor ?? '',
        driverAccentColor: nextOverview.tenant.driverAccentColor ?? '',
        driverBackgroundColor: nextOverview.tenant.driverBackgroundColor ?? '',
        driverForegroundColor: nextOverview.tenant.driverForegroundColor ?? '',
        reason: '',
      });
      setInviteForm((current) => ({
        ...current,
        tenantRoleKey: current.tenantRoleKey || nextTeam.roles[0]?.key || '',
      }));
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load tenant workspace.');
    } finally {
      loadingRef.current = false;
      setLoading(false);
    }
  }, [canLoad, tenantId]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const sidebarItems = useMemo(() => getSuperadminSidebarItems(), []);

  if (!currentUser || currentUser.role !== 'superadmin' || !tenantId) {
    return (
      <div className="space-y-6 p-6">
        <p className="text-sm text-muted-foreground">Loading tenant workspace...</p>
      </div>
    );
  }

  const tenant = overview?.tenant;
  const teamMembers = teamData?.members ?? [];
  const roles = teamData?.roles ?? [];
  const drivers = driversData?.drivers ?? [];
  const terminals = terminalsData?.terminals ?? [];
  const rides = ridesData?.rides ?? [];
  const reservations = reservationsData?.reservations ?? [];
  const auditLogs = auditData?.logs ?? [];

  const filteredTeamMembers = teamMembers.filter((member) =>
    matchesSearch([member.name, member.email, member.tenantRoleName, member.tenantRoleKey], teamSearch)
  );
  const filteredDrivers = drivers.filter((driver) =>
    matchesSearch([driver.name, driver.email, driver.phone, driver.todaName], driverSearch)
  );
  const filteredTerminals = terminals.filter((terminal) =>
    matchesSearch([terminal.name, terminal.location], terminalSearch)
  );
  const filteredRides = rides.filter((ride) =>
    matchesSearch(
      [ride.pickupLocation, ride.dropoffLocation, ride.passenger.name, ride.driver?.name, ride.terminal?.name, ride.status],
      rideSearch
    )
  );
  const filteredReservations = reservations.filter((reservation) =>
    matchesSearch(
      [reservation.passenger.name, reservation.terminal.name, reservation.status, String(reservation.queuePosition)],
      reservationSearch
    )
  );

  const handleLifecycleSave = async () => {
    if (!tenant || lifecycleReason.trim().length < 5 || savingLifecycle) return;

    setSavingLifecycle(true);
    setError(null);

    try {
      const nextStatus = tenant.status === 'suspended' ? 'active' : 'suspended';
      await updateSuperadminTenant(tenant.id, {
        reason: lifecycleReason.trim(),
        status: nextStatus,
        suspensionReason: nextStatus === 'suspended' ? lifecycleMessage.trim() || null : null,
      });
      setLifecycleDialogOpen(false);
      setLifecycleReason('');
      setLifecycleMessage('');
      setNotice(`${tenant.name} is now ${nextStatus}.`);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update tenant status.');
    } finally {
      setSavingLifecycle(false);
    }
  };

  const handleBrandingSave = async () => {
    if (!tenant || brandingDraft.reason.trim().length < 5 || savingBranding) return;

    setSavingBranding(true);
    setError(null);

    try {
      await updateSuperadminTenant(tenant.id, {
        reason: brandingDraft.reason.trim(),
        logoUrl: brandingDraft.logoUrl.trim() || null,
        faviconUrl: brandingDraft.faviconUrl.trim() || null,
        primaryColor: brandingDraft.primaryColor.trim() || null,
        accentColor: brandingDraft.accentColor.trim() || null,
        backgroundColor: brandingDraft.backgroundColor.trim() || null,
        foregroundColor: brandingDraft.foregroundColor.trim() || null,
        driverPrimaryColor: brandingDraft.driverPrimaryColor.trim() || null,
        driverAccentColor: brandingDraft.driverAccentColor.trim() || null,
        driverBackgroundColor: brandingDraft.driverBackgroundColor.trim() || null,
        driverForegroundColor: brandingDraft.driverForegroundColor.trim() || null,
      });
      setNotice('Tenant branding updated.');
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update branding.');
    } finally {
      setSavingBranding(false);
    }
  };

  const handleInviteMember = async () => {
    if (!tenant || inviteForm.reason.trim().length < 5 || savingTeam) return;

    setSavingTeam(true);
    setError(null);

    try {
      await inviteSuperadminTenantTeamMember(tenant.id, {
        name: inviteForm.name,
        email: inviteForm.email,
        tenantRoleKey: inviteForm.tenantRoleKey,
        reason: inviteForm.reason,
      });
      setInviteDialogOpen(false);
      setInviteForm({
        name: '',
        email: '',
        tenantRoleKey: roles[0]?.key ?? '',
        reason: '',
      });
      setNotice('Tenant team member invited.');
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to invite tenant team member.');
    } finally {
      setSavingTeam(false);
    }
  };

  const handleTeamMemberUpdate = async (membershipId: string, input: { tenantRoleKey?: string; isActive?: boolean }) => {
    if (!tenant || savingTeam) return;
    const reason = window.prompt('Reason for this tenant team change?');
    if (!reason || reason.trim().length < 5) return;

    setSavingTeam(true);
    setError(null);
    try {
      await updateSuperadminTenantTeamMember(tenant.id, membershipId, {
        ...input,
        reason: reason.trim(),
      });
      setNotice('Tenant team updated.');
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update tenant team.');
    } finally {
      setSavingTeam(false);
    }
  };

  const handleSettingsSave = async () => {
    if (!tenant || !settingsDraft || settingsReason.trim().length < 5 || savingSettings) return;

    setSavingSettings(true);
    setError(null);
    try {
      await updateSuperadminTenantSettings(tenant.id, {
        settings: settingsDraft,
        reason: settingsReason.trim(),
      });
      setSettingsReason('');
      setNotice('Tenant settings updated.');
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update tenant settings.');
    } finally {
      setSavingSettings(false);
    }
  };

  const handleDriverAction = async () => {
    if (!tenant || !driverAction || driverReason.trim().length < 5 || savingDriver) return;

    setSavingDriver(true);
    setError(null);
    try {
      if (driverAction.kind === 'verify') {
        await updateSuperadminTenantDriverVerification(tenant.id, driverAction.driverId, {
          isDriverVerified: true,
          reason: driverReason.trim(),
        });
      } else {
        await updateSuperadminTenantDriverRestriction(tenant.id, driverAction.driverId, {
          isDriverRestricted: driverAction.kind === 'restrict',
          reason: driverReason.trim(),
        });
      }
      setDriverAction(null);
      setDriverReason('');
      setNotice('Driver status updated.');
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update driver state.');
    } finally {
      setSavingDriver(false);
    }
  };

  const handleTerminalSave = async () => {
    if (!tenant || !terminalDialog || terminalDialog.reason.trim().length < 5 || savingTerminal) return;

    setSavingTerminal(true);
    setError(null);

    try {
      const payload = {
        name: terminalDialog.name,
        location: terminalDialog.location,
        latitude: Number(terminalDialog.latitude),
        longitude: Number(terminalDialog.longitude),
        reason: terminalDialog.reason.trim(),
      };

      if (terminalDialog.id) {
        await updateSuperadminTenantTerminal(tenant.id, terminalDialog.id, {
          ...payload,
          capacity: terminalDialog.capacity ? Number(terminalDialog.capacity) : undefined,
        });
      } else {
        await createSuperadminTenantTerminal(tenant.id, payload);
      }

      setTerminalDialog(null);
      setNotice('Terminal saved.');
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save terminal.');
    } finally {
      setSavingTerminal(false);
    }
  };

  return (
    <>
      <AppHeader />
      <div className="max-w-7xl mx-auto px-4 pb-8">
        <SidebarLayout title="Superadmin Menu" items={sidebarItems}>
          <div className="space-y-6">
            <PageHeader
              eyebrow="Tenant Workspace"
              title={tenant?.name ?? 'Tenant'}
              description={
                tenant
                  ? `${tenant.lguName} | ${tenant.regionName ?? 'Unknown region'} | Status: ${tenant.status}`
                  : 'Loading tenant workspace.'
              }
              actions={
                <>
                  {tenant ? (
                    <Button asChild variant="outline">
                      <Link href={`/superadmin/passengers?tenantId=${tenant.id}`}>View Passengers</Link>
                    </Button>
                  ) : null}
                  <Button asChild variant="outline">
                    <Link href="/superadmin/tenants">Back to Tenants</Link>
                  </Button>
                </>
              }
            />

            {notice ? (
              <p className="rounded-xl border border-primary/25 bg-primary/10 px-4 py-3 text-sm text-primary">
                {notice}
              </p>
            ) : null}

            {error ? (
              <InlineErrorState message={error} onRetry={() => void loadData()} retryLabel="Retry tenant workspace" />
            ) : null}

            {loading || !overview || !settingsData ? (
              <div className="rounded-2xl border px-4 py-8 text-sm text-muted-foreground">Loading tenant workspace...</div>
            ) : (
              <>
                <SummaryStrip
                  items={[
                    { label: 'Passengers', value: overview.stats.passengers },
                    { label: 'Drivers', value: overview.stats.drivers },
                    { label: 'Trips', value: overview.stats.totalRides },
                    { label: 'Reservations', value: overview.stats.totalReservations },
                    {
                      label: 'Revenue',
                      value: formatCurrency(overview.stats.completedRevenue),
                      emphasized: true,
                    },
                  ]}
                  className="md:grid-cols-2 xl:grid-cols-5"
                />

                <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as TenantTab)} className="space-y-6">
                  <TabsList className="h-auto flex-wrap rounded-2xl">
                    <TabsTrigger value="overview">Overview</TabsTrigger>
                    <TabsTrigger value="team">Team</TabsTrigger>
                    <TabsTrigger value="settings">Settings</TabsTrigger>
                    <TabsTrigger value="audit">Audit</TabsTrigger>
                    <TabsTrigger value="drivers">Drivers</TabsTrigger>
                    <TabsTrigger value="terminals">Terminals</TabsTrigger>
                    <TabsTrigger value="rides">Rides</TabsTrigger>
                    <TabsTrigger value="reservations">Reservations</TabsTrigger>
                  </TabsList>

                  <TabsContent value="overview" className="space-y-6">
                    <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
                      <TableSurface
                        title="Tenant Lifecycle"
                        description="Activate or suspend the workspace and control the message tenant users will see."
                        actions={
                          <Button onClick={() => setLifecycleDialogOpen(true)}>
                            {overview.tenant.status === 'suspended' ? 'Activate Tenant' : 'Suspend Tenant'}
                          </Button>
                        }
                      >
                        <div className="grid gap-4 md:grid-cols-2">
                          <div className="rounded-xl border px-4 py-3">
                            <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Current Status</p>
                            <p className={`mt-2 text-lg font-semibold ${overview.tenant.status === 'suspended' ? 'text-amber-700' : 'text-emerald-700'}`}>
                              {overview.tenant.status === 'suspended' ? 'Suspended' : 'Active'}
                            </p>
                          </div>
                          <div className="rounded-xl border px-4 py-3">
                            <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Suspension Reason</p>
                            <p className="mt-2 text-sm">
                              {overview.tenant.suspensionReason ?? 'No suspension message recorded.'}
                            </p>
                          </div>
                        </div>
                      </TableSurface>

                      <TableSurface
                        title="Branding Basics"
                        description="Update tenant logo and colors. These changes also feed tenant settings branding."
                      >
                        <div className="space-y-4">
                          <div className="grid gap-4 md:grid-cols-4">
                            <div className="space-y-2 md:col-span-2">
                              <Label htmlFor="branding-logo">Logo URL</Label>
                              <Input
                                id="branding-logo"
                                value={brandingDraft.logoUrl}
                                onChange={(event) =>
                                  setBrandingDraft((current) => ({ ...current, logoUrl: event.target.value }))
                                }
                                placeholder="/trissea-logo.png"
                              />
                            </div>
                            <div className="space-y-2 md:col-span-2">
                              <Label htmlFor="branding-favicon">Favicon URL</Label>
                              <Input
                                id="branding-favicon"
                                value={brandingDraft.faviconUrl}
                                onChange={(event) =>
                                  setBrandingDraft((current) => ({ ...current, faviconUrl: event.target.value }))
                                }
                                placeholder="/trissea-icon-32.png"
                              />
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor="branding-primary">Primary Color</Label>
                              <Input
                                id="branding-primary"
                                value={brandingDraft.primaryColor}
                                onChange={(event) =>
                                  setBrandingDraft((current) => ({ ...current, primaryColor: event.target.value }))
                                }
                                placeholder="#14622e"
                              />
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor="branding-accent">Accent Color</Label>
                              <Input
                                id="branding-accent"
                                value={brandingDraft.accentColor}
                                onChange={(event) =>
                                  setBrandingDraft((current) => ({ ...current, accentColor: event.target.value }))
                                }
                                placeholder="#fecc04"
                              />
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor="branding-background">Background</Label>
                              <Input
                                id="branding-background"
                                value={brandingDraft.backgroundColor}
                                onChange={(event) =>
                                  setBrandingDraft((current) => ({ ...current, backgroundColor: event.target.value }))
                                }
                                placeholder="#f5f9f7"
                              />
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor="branding-foreground">Text Color</Label>
                              <Input
                                id="branding-foreground"
                                value={brandingDraft.foregroundColor}
                                onChange={(event) =>
                                  setBrandingDraft((current) => ({ ...current, foregroundColor: event.target.value }))
                                }
                                placeholder="#0f1f16"
                              />
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor="branding-driver-primary">Driver Primary</Label>
                              <Input
                                id="branding-driver-primary"
                                value={brandingDraft.driverPrimaryColor}
                                onChange={(event) =>
                                  setBrandingDraft((current) => ({ ...current, driverPrimaryColor: event.target.value }))
                                }
                                placeholder="#0f4d26"
                              />
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor="branding-driver-accent">Driver Accent</Label>
                              <Input
                                id="branding-driver-accent"
                                value={brandingDraft.driverAccentColor}
                                onChange={(event) =>
                                  setBrandingDraft((current) => ({ ...current, driverAccentColor: event.target.value }))
                                }
                                placeholder="#fecc04"
                              />
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor="branding-driver-background">Driver Background</Label>
                              <Input
                                id="branding-driver-background"
                                value={brandingDraft.driverBackgroundColor}
                                onChange={(event) =>
                                  setBrandingDraft((current) => ({ ...current, driverBackgroundColor: event.target.value }))
                                }
                                placeholder="#f5f9f7"
                              />
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor="branding-driver-foreground">Driver Text</Label>
                              <Input
                                id="branding-driver-foreground"
                                value={brandingDraft.driverForegroundColor}
                                onChange={(event) =>
                                  setBrandingDraft((current) => ({ ...current, driverForegroundColor: event.target.value }))
                                }
                                placeholder="#0f1f16"
                              />
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor="branding-reason">Audit Reason</Label>
                              <Input
                                id="branding-reason"
                                value={brandingDraft.reason}
                                onChange={(event) =>
                                  setBrandingDraft((current) => ({ ...current, reason: event.target.value }))
                                }
                                placeholder="Why are you changing branding?"
                              />
                            </div>
                          </div>
                          <div className="flex justify-end">
                            <Button onClick={() => void handleBrandingSave()} disabled={savingBranding || brandingDraft.reason.trim().length < 5}>
                              <PendingButtonContent pending={savingBranding} label="Save Branding" />
                            </Button>
                          </div>
                        </div>
                      </TableSurface>
                    </div>

                    <div className="grid gap-6 xl:grid-cols-2">
                      <TableSurface title="Recent Rides" description="Newest tenant rides with passenger and terminal context." bodyClassName="pt-0">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Route</TableHead>
                              <TableHead>Passenger</TableHead>
                              <TableHead>Status</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {overview.recentRides.map((ride) => (
                              <TableRow key={ride.id}>
                                <TableCell>
                                  <div className="space-y-1">
                                    <p className="font-medium">{ride.pickupLocation}</p>
                                    <p className="text-xs text-muted-foreground">to {ride.dropoffLocation}</p>
                                  </div>
                                </TableCell>
                                <TableCell>
                                  <Link href={`/superadmin/passengers/${ride.passenger.id}`} className="text-primary hover:underline">
                                    {ride.passenger.name}
                                  </Link>
                                </TableCell>
                                <TableCell>{ride.status}</TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </TableSurface>

                      <TableSurface title="Recent Reservations" description="Newest reservation activity in this tenant." bodyClassName="pt-0">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Passenger</TableHead>
                              <TableHead>Terminal</TableHead>
                              <TableHead>Status</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {overview.recentReservations.map((reservation) => (
                              <TableRow key={reservation.id}>
                                <TableCell>
                                  <Link
                                    href={`/superadmin/passengers/${reservation.passenger.id}`}
                                    className="text-primary hover:underline"
                                  >
                                    {reservation.passenger.name}
                                  </Link>
                                </TableCell>
                                <TableCell>{reservation.terminal.name}</TableCell>
                                <TableCell>{reservation.status}</TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </TableSurface>
                    </div>
                  </TabsContent>

                  <TabsContent value="team" className="space-y-6">
                    <FilterBar>
                      <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_200px]">
                        <div className="space-y-2">
                          <Label>Search team</Label>
                          <div className="relative">
                            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                            <Input value={teamSearch} onChange={(event) => setTeamSearch(event.target.value)} className="pl-9" />
                          </div>
                        </div>
                        <div className="flex items-end justify-end">
                          <Button onClick={() => setInviteDialogOpen(true)}>Invite Member</Button>
                        </div>
                      </div>
                    </FilterBar>

                    <TableSurface title="Tenant Team" description="Manage role assignments and membership state." bodyClassName="pt-0">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Member</TableHead>
                            <TableHead>Role</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Invited By</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {filteredTeamMembers.map((member) => (
                            <TableRow key={member.id}>
                              <TableCell>
                                <div className="space-y-1">
                                  <p className="font-medium">{member.name}</p>
                                  <p className="text-xs text-muted-foreground">{member.email ?? 'No email on file'}</p>
                                </div>
                              </TableCell>
                              <TableCell>
                                <Select
                                  value={member.tenantRoleKey}
                                  onValueChange={(value) =>
                                    void handleTeamMemberUpdate(member.id, { tenantRoleKey: value })
                                  }
                                >
                                  <SelectTrigger className="w-[190px]">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {roles.map((role) => (
                                      <SelectItem key={role.key} value={role.key}>
                                        {role.name}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </TableCell>
                              <TableCell>{member.isActive ? 'Active' : 'Inactive'}</TableCell>
                              <TableCell>{member.invitedByName ?? 'Seeded / legacy'}</TableCell>
                              <TableCell className="text-right">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => void handleTeamMemberUpdate(member.id, { isActive: !member.isActive })}
                                >
                                  {member.isActive ? 'Deactivate' : 'Reactivate'}
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </TableSurface>
                  </TabsContent>

                  <TabsContent value="settings" className="space-y-6">
                    {settingsDraft ? (
                      <>
                        <TableSurface title="Workspace Modules" description="Toggle tenant-visible modules and dashboard widgets.">
                          <div className="grid gap-4 md:grid-cols-2">
                            <label className="flex items-center gap-3">
                              <Checkbox
                                checked={settingsDraft.moduleVisibility.reportsVisible}
                                onCheckedChange={(checked) =>
                                  setSettingsDraft({
                                    ...settingsDraft,
                                    moduleVisibility: {
                                      ...settingsDraft.moduleVisibility,
                                      reportsVisible: checked === true,
                                    },
                                  })
                                }
                              />
                              <span className="text-sm">Reports visible</span>
                            </label>
                            <label className="flex items-center gap-3">
                              <Checkbox
                                checked={settingsDraft.moduleVisibility.tenantTeamVisible}
                                onCheckedChange={(checked) =>
                                  setSettingsDraft({
                                    ...settingsDraft,
                                    moduleVisibility: {
                                      ...settingsDraft.moduleVisibility,
                                      tenantTeamVisible: checked === true,
                                    },
                                  })
                                }
                              />
                              <span className="text-sm">Tenant team visible</span>
                            </label>
                            <label className="flex items-center gap-3">
                              <Checkbox
                                checked={settingsDraft.moduleVisibility.dashboardWidgets.liveTripQueue}
                                onCheckedChange={(checked) =>
                                  setSettingsDraft({
                                    ...settingsDraft,
                                    moduleVisibility: {
                                      ...settingsDraft.moduleVisibility,
                                      dashboardWidgets: {
                                        ...settingsDraft.moduleVisibility.dashboardWidgets,
                                        liveTripQueue: checked === true,
                                      },
                                    },
                                  })
                                }
                              />
                              <span className="text-sm">Dashboard live trip queue</span>
                            </label>
                            <label className="flex items-center gap-3">
                              <Checkbox
                                checked={settingsDraft.moduleVisibility.dashboardWidgets.queueWatch}
                                onCheckedChange={(checked) =>
                                  setSettingsDraft({
                                    ...settingsDraft,
                                    moduleVisibility: {
                                      ...settingsDraft.moduleVisibility,
                                      dashboardWidgets: {
                                        ...settingsDraft.moduleVisibility.dashboardWidgets,
                                        queueWatch: checked === true,
                                      },
                                    },
                                  })
                                }
                              />
                              <span className="text-sm">Dashboard queue watch</span>
                            </label>
                            <label className="flex items-center gap-3">
                              <Checkbox
                                checked={settingsDraft.moduleVisibility.dashboardWidgets.onlineDrivers}
                                onCheckedChange={(checked) =>
                                  setSettingsDraft({
                                    ...settingsDraft,
                                    moduleVisibility: {
                                      ...settingsDraft.moduleVisibility,
                                      dashboardWidgets: {
                                        ...settingsDraft.moduleVisibility.dashboardWidgets,
                                        onlineDrivers: checked === true,
                                      },
                                    },
                                  })
                                }
                              />
                              <span className="text-sm">Dashboard online drivers</span>
                            </label>
                            <label className="flex items-center gap-3">
                              <Checkbox
                                checked={settingsDraft.moduleVisibility.dashboardWidgets.operationalSummary}
                                onCheckedChange={(checked) =>
                                  setSettingsDraft({
                                    ...settingsDraft,
                                    moduleVisibility: {
                                      ...settingsDraft.moduleVisibility,
                                      dashboardWidgets: {
                                        ...settingsDraft.moduleVisibility.dashboardWidgets,
                                        operationalSummary: checked === true,
                                      },
                                    },
                                  })
                                }
                              />
                              <span className="text-sm">Dashboard operational summary</span>
                            </label>
                          </div>
                        </TableSurface>

                        <TableSurface title="Operational Defaults" description="Control default tabs, fare logic, and UI preferences.">
                          <div className="grid gap-4 md:grid-cols-3">
                            <div className="space-y-2">
                              <Label>Drivers Default Tab</Label>
                              <Select
                                value={settingsDraft.operationsPreferences.driversDefaultTab}
                                onValueChange={(value) =>
                                  setSettingsDraft({
                                    ...settingsDraft,
                                    operationsPreferences: {
                                      ...settingsDraft.operationsPreferences,
                                      driversDefaultTab: value as typeof settingsDraft.operationsPreferences.driversDefaultTab,
                                    },
                                  })
                                }
                              >
                                <SelectTrigger>
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="verified">Verified</SelectItem>
                                  <SelectItem value="unverified">Unverified</SelectItem>
                                  <SelectItem value="restricted">Restricted</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="space-y-2">
                              <Label>Reservations Default Tab</Label>
                              <Select
                                value={settingsDraft.operationsPreferences.reservationsDefaultTab}
                                onValueChange={(value) =>
                                  setSettingsDraft({
                                    ...settingsDraft,
                                    operationsPreferences: {
                                      ...settingsDraft.operationsPreferences,
                                      reservationsDefaultTab:
                                        value as typeof settingsDraft.operationsPreferences.reservationsDefaultTab,
                                    },
                                  })
                                }
                              >
                                <SelectTrigger>
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="active">Active</SelectItem>
                                  <SelectItem value="completed">Completed</SelectItem>
                                  <SelectItem value="cancelled">Cancelled</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="space-y-2">
                              <Label>Trips Default Tab</Label>
                              <Select
                                value={settingsDraft.operationsPreferences.tripsDefaultTab}
                                onValueChange={(value) =>
                                  setSettingsDraft({
                                    ...settingsDraft,
                                    operationsPreferences: {
                                      ...settingsDraft.operationsPreferences,
                                      tripsDefaultTab: value as typeof settingsDraft.operationsPreferences.tripsDefaultTab,
                                    },
                                  })
                                }
                              >
                                <SelectTrigger>
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="active">Active</SelectItem>
                                  <SelectItem value="completed">Completed</SelectItem>
                                  <SelectItem value="cancelled">Cancelled</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="space-y-2">
                              <Label>Base Fare</Label>
                              <Input
                                type="number"
                                value={settingsDraft.operationsPreferences.onDemandFare.baseFare}
                                onChange={(event) =>
                                  setSettingsDraft({
                                    ...settingsDraft,
                                    operationsPreferences: {
                                      ...settingsDraft.operationsPreferences,
                                      onDemandFare: {
                                        ...settingsDraft.operationsPreferences.onDemandFare,
                                        baseFare: Number(event.target.value),
                                      },
                                    },
                                  })
                                }
                              />
                            </div>
                            <div className="space-y-2">
                              <Label>Per KM Fare</Label>
                              <Input
                                type="number"
                                value={settingsDraft.operationsPreferences.onDemandFare.perKmFare}
                                onChange={(event) =>
                                  setSettingsDraft({
                                    ...settingsDraft,
                                    operationsPreferences: {
                                      ...settingsDraft.operationsPreferences,
                                      onDemandFare: {
                                        ...settingsDraft.operationsPreferences.onDemandFare,
                                        perKmFare: Number(event.target.value),
                                      },
                                    },
                                  })
                                }
                              />
                            </div>
                            <div className="space-y-2">
                              <Label>Per Minute Fare</Label>
                              <Input
                                type="number"
                                value={settingsDraft.operationsPreferences.onDemandFare.perMinuteFare}
                                onChange={(event) =>
                                  setSettingsDraft({
                                    ...settingsDraft,
                                    operationsPreferences: {
                                      ...settingsDraft.operationsPreferences,
                                      onDemandFare: {
                                        ...settingsDraft.operationsPreferences.onDemandFare,
                                        perMinuteFare: Number(event.target.value),
                                      },
                                    },
                                  })
                                }
                              />
                            </div>
                            <label className="flex items-center gap-3 md:col-span-3">
                              <Checkbox
                                checked={settingsDraft.uiPreferences.denseTables}
                                onCheckedChange={(checked) =>
                                  setSettingsDraft({
                                    ...settingsDraft,
                                    uiPreferences: {
                                      ...settingsDraft.uiPreferences,
                                      denseTables: checked === true,
                                    },
                                  })
                                }
                              />
                              <span className="text-sm">Dense tables</span>
                            </label>
                            <label className="flex items-center gap-3 md:col-span-3">
                              <Checkbox
                                checked={settingsDraft.uiPreferences.showKpiStrip}
                                onCheckedChange={(checked) =>
                                  setSettingsDraft({
                                    ...settingsDraft,
                                    uiPreferences: {
                                      ...settingsDraft.uiPreferences,
                                      showKpiStrip: checked === true,
                                    },
                                  })
                                }
                              />
                              <span className="text-sm">Show KPI strip</span>
                            </label>
                          </div>
                        </TableSurface>

                        <TableSurface title="Terminal Fare Adjustments" description="Flat fare adjustments applied per terminal.">
                          <div className="space-y-3">
                            {terminals.map((terminal) => (
                              <div key={terminal.id} className="grid gap-3 rounded-xl border px-4 py-3 md:grid-cols-[1fr_180px] md:items-center">
                                <div>
                                  <p className="font-medium">{terminal.name}</p>
                                  <p className="text-xs text-muted-foreground">{terminal.location}</p>
                                </div>
                                <Input
                                  type="number"
                                  value={getTerminalAdjustment(settingsDraft, terminal.id)}
                                  onChange={(event) =>
                                    setSettingsDraft(
                                      setTerminalAdjustment(settingsDraft, terminal.id, Number(event.target.value))
                                    )
                                  }
                                />
                              </div>
                            ))}
                          </div>
                        </TableSurface>

                        <FilterBar>
                          <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_180px]">
                            <div className="space-y-2">
                              <Label htmlFor="settings-reason">Audit Reason</Label>
                              <Input
                                id="settings-reason"
                                value={settingsReason}
                                onChange={(event) => setSettingsReason(event.target.value)}
                                placeholder="Why are you updating tenant settings?"
                              />
                            </div>
                            <div className="flex items-end justify-end">
                              <Button onClick={() => void handleSettingsSave()} disabled={savingSettings || settingsReason.trim().length < 5}>
                                <PendingButtonContent pending={savingSettings} label="Save Settings" />
                              </Button>
                            </div>
                          </div>
                        </FilterBar>
                      </>
                    ) : null}
                  </TabsContent>

                  <TabsContent value="audit" className="space-y-6">
                    <TableSurface title="Tenant Audit Log" description="Recent tenant-scoped changes, including superadmin interventions." bodyClassName="pt-0">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>When</TableHead>
                            <TableHead>Module</TableHead>
                            <TableHead>Action</TableHead>
                            <TableHead>Actor</TableHead>
                            <TableHead>Target</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {auditLogs.map((log) => (
                            <TableRow key={log.id}>
                              <TableCell>{formatDateTime(log.createdAt)}</TableCell>
                              <TableCell>{log.module}</TableCell>
                              <TableCell>{log.action}</TableCell>
                              <TableCell>{log.actor?.name ?? 'System'}</TableCell>
                              <TableCell>{log.targetType}{log.targetId ? `: ${log.targetId}` : ''}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </TableSurface>
                  </TabsContent>

                  <TabsContent value="drivers" className="space-y-6">
                    <FilterBar>
                      <div className="space-y-2">
                        <Label>Search drivers</Label>
                        <div className="relative">
                          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                          <Input value={driverSearch} onChange={(event) => setDriverSearch(event.target.value)} className="pl-9" />
                        </div>
                      </div>
                    </FilterBar>

                    <TableSurface title="Drivers" description="Verify, restrict, and reinstate tenant drivers." bodyClassName="pt-0">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Driver</TableHead>
                            <TableHead>TODA</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Completed</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {filteredDrivers.map((driver) => (
                            <TableRow key={driver.id}>
                              <TableCell>
                                <div className="space-y-1">
                                  <p className="font-medium">{driver.name}</p>
                                  <p className="text-xs text-muted-foreground">{driver.phone ?? driver.email ?? 'No contact'}</p>
                                </div>
                              </TableCell>
                              <TableCell>{driver.todaName ?? 'Unassigned'}</TableCell>
                              <TableCell>
                                {driver.isDriverRestricted
                                  ? 'Restricted'
                                  : driver.isDriverVerified
                                    ? driver.DriverPresence?.isOnline
                                      ? 'Verified / Online'
                                      : 'Verified'
                                    : 'Pending'}
                              </TableCell>
                              <TableCell>{driver.completedRides ?? 0}</TableCell>
                              <TableCell className="text-right">
                                <div className="flex justify-end gap-2">
                                  {!driver.isDriverVerified ? (
                                    <Button
                                      size="sm"
                                      onClick={() => setDriverAction({ driverId: driver.id, name: driver.name, kind: 'verify' })}
                                    >
                                      Verify
                                    </Button>
                                  ) : (
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() =>
                                        setDriverAction({
                                          driverId: driver.id,
                                          name: driver.name,
                                          kind: driver.isDriverRestricted ? 'reinstate' : 'restrict',
                                        })
                                      }
                                    >
                                      {driver.isDriverRestricted ? 'Reinstate' : 'Restrict'}
                                    </Button>
                                  )}
                                </div>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </TableSurface>
                  </TabsContent>

                  <TabsContent value="terminals" className="space-y-6">
                    <FilterBar>
                      <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_180px]">
                        <div className="space-y-2">
                          <Label>Search terminals</Label>
                          <div className="relative">
                            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                            <Input value={terminalSearch} onChange={(event) => setTerminalSearch(event.target.value)} className="pl-9" />
                          </div>
                        </div>
                        <div className="flex items-end justify-end">
                          <Button
                            onClick={() =>
                              setTerminalDialog({
                                name: '',
                                location: '',
                                latitude: '',
                                longitude: '',
                                capacity: '',
                                reason: '',
                              })
                            }
                          >
                            Add Terminal
                          </Button>
                        </div>
                      </div>
                    </FilterBar>

                    <TableSurface title="Terminals" description="Create and update TODA terminals for this tenant." bodyClassName="pt-0">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Terminal</TableHead>
                            <TableHead>Location</TableHead>
                            <TableHead>Capacity</TableHead>
                            <TableHead>Queue</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {filteredTerminals.map((terminal) => (
                            <TableRow key={terminal.id}>
                              <TableCell>{terminal.name}</TableCell>
                              <TableCell>{terminal.location}</TableCell>
                              <TableCell>{terminal.capacity}</TableCell>
                              <TableCell>{terminal.currentQueued}</TableCell>
                              <TableCell className="text-right">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() =>
                                    setTerminalDialog({
                                      id: terminal.id,
                                      name: terminal.name,
                                      location: terminal.location,
                                      latitude: String(terminal.latitude),
                                      longitude: String(terminal.longitude),
                                      capacity: String(terminal.capacity),
                                      reason: '',
                                    })
                                  }
                                >
                                  Edit
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </TableSurface>
                  </TabsContent>

                  <TabsContent value="rides" className="space-y-6">
                    <FilterBar>
                      <div className="space-y-2">
                        <Label>Search rides</Label>
                        <div className="relative">
                          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                          <Input value={rideSearch} onChange={(event) => setRideSearch(event.target.value)} className="pl-9" />
                        </div>
                      </div>
                    </FilterBar>

                    <TableSurface title="Rides" description="Read-only ride visibility across the tenant." bodyClassName="pt-0">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Route</TableHead>
                            <TableHead>Passenger</TableHead>
                            <TableHead>Driver</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Fare</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {filteredRides.map((ride) => (
                            <TableRow key={ride.id}>
                              <TableCell>
                                <div className="space-y-1">
                                  <p className="font-medium">{ride.pickupLocation}</p>
                                  <p className="text-xs text-muted-foreground">to {ride.dropoffLocation}</p>
                                </div>
                              </TableCell>
                              <TableCell>
                                <Link href={`/superadmin/passengers/${ride.passenger.id}`} className="text-primary hover:underline">
                                  {ride.passenger.name}
                                </Link>
                              </TableCell>
                              <TableCell>{ride.driver?.name ?? 'Unassigned'}</TableCell>
                              <TableCell>{ride.status}</TableCell>
                              <TableCell>{formatCurrency(ride.fare)}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </TableSurface>
                  </TabsContent>

                  <TabsContent value="reservations" className="space-y-6">
                    <FilterBar>
                      <div className="space-y-2">
                        <Label>Search reservations</Label>
                        <div className="relative">
                          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                          <Input
                            value={reservationSearch}
                            onChange={(event) => setReservationSearch(event.target.value)}
                            className="pl-9"
                          />
                        </div>
                      </div>
                    </FilterBar>

                    <TableSurface title="Reservations" description="Read-only reservation visibility across the tenant." bodyClassName="pt-0">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Passenger</TableHead>
                            <TableHead>Terminal</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Queue</TableHead>
                            <TableHead>Boarding</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {filteredReservations.map((reservation) => (
                            <TableRow key={reservation.id}>
                              <TableCell>
                                <Link href={`/superadmin/passengers/${reservation.passenger.id}`} className="text-primary hover:underline">
                                  {reservation.passenger.name}
                                </Link>
                              </TableCell>
                              <TableCell>{reservation.terminal.name}</TableCell>
                              <TableCell>{reservation.status}</TableCell>
                              <TableCell>{reservation.queuePosition}</TableCell>
                              <TableCell>{formatDateTime(reservation.boardingTime)}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </TableSurface>
                  </TabsContent>
                </Tabs>
              </>
            )}
          </div>
        </SidebarLayout>
      </div>

      <Dialog open={inviteDialogOpen} onOpenChange={setInviteDialogOpen}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Invite Tenant Team Member</DialogTitle>
            <DialogDescription>Create or reactivate a tenant staff account from the platform workspace.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="invite-name">Name</Label>
              <Input id="invite-name" value={inviteForm.name} onChange={(event) => setInviteForm((current) => ({ ...current, name: event.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="invite-email">Email</Label>
              <Input id="invite-email" type="email" value={inviteForm.email} onChange={(event) => setInviteForm((current) => ({ ...current, email: event.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Role</Label>
              <Select value={inviteForm.tenantRoleKey} onValueChange={(value) => setInviteForm((current) => ({ ...current, tenantRoleKey: value }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {roles.map((role) => (
                    <SelectItem key={role.key} value={role.key}>
                      {role.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="invite-reason">Audit Reason</Label>
              <Textarea id="invite-reason" value={inviteForm.reason} onChange={(event) => setInviteForm((current) => ({ ...current, reason: event.target.value }))} rows={3} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setInviteDialogOpen(false)} disabled={savingTeam}>
              Cancel
            </Button>
            <Button onClick={() => void handleInviteMember()} disabled={savingTeam || inviteForm.reason.trim().length < 5}>
              <PendingButtonContent pending={savingTeam} label="Invite Member" />
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={lifecycleDialogOpen} onOpenChange={setLifecycleDialogOpen}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>{tenant?.status === 'suspended' ? 'Activate Tenant' : 'Suspend Tenant'}</DialogTitle>
            <DialogDescription>
              {tenant?.status === 'suspended'
                ? 'Restore tenant access.'
                : 'Block tenant-scoped access and record the message users should see.'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {tenant?.status !== 'suspended' ? (
              <div className="space-y-2">
                <Label htmlFor="lifecycle-message">Suspension Message</Label>
                <Textarea id="lifecycle-message" value={lifecycleMessage} onChange={(event) => setLifecycleMessage(event.target.value)} rows={3} />
              </div>
            ) : null}
            <div className="space-y-2">
              <Label htmlFor="lifecycle-reason">Audit Reason</Label>
              <Textarea id="lifecycle-reason" value={lifecycleReason} onChange={(event) => setLifecycleReason(event.target.value)} rows={3} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setLifecycleDialogOpen(false)} disabled={savingLifecycle}>
              Cancel
            </Button>
            <Button onClick={() => void handleLifecycleSave()} disabled={savingLifecycle || lifecycleReason.trim().length < 5}>
              <PendingButtonContent pending={savingLifecycle} label={tenant?.status === 'suspended' ? 'Activate Tenant' : 'Suspend Tenant'} />
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(driverAction)} onOpenChange={(open) => !open && setDriverAction(null)}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Driver Action</DialogTitle>
            <DialogDescription>
              {driverAction?.kind === 'verify'
                ? `Approve ${driverAction.name} as a verified driver.`
                : driverAction?.kind === 'restrict'
                  ? `Restrict ${driverAction?.name} from tenant operations.`
                  : `Reinstate ${driverAction?.name} back into tenant operations.`}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="driver-reason">Audit Reason</Label>
            <Textarea id="driver-reason" value={driverReason} onChange={(event) => setDriverReason(event.target.value)} rows={3} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDriverAction(null)} disabled={savingDriver}>
              Cancel
            </Button>
            <Button onClick={() => void handleDriverAction()} disabled={savingDriver || driverReason.trim().length < 5}>
              <PendingButtonContent pending={savingDriver} label="Apply Action" />
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(terminalDialog)} onOpenChange={(open) => !open && setTerminalDialog(null)}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{terminalDialog?.id ? 'Edit Terminal' : 'Create Terminal'}</DialogTitle>
            <DialogDescription>Manage terminal records from the platform workspace.</DialogDescription>
          </DialogHeader>
          {terminalDialog ? (
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Name</Label>
                <Input value={terminalDialog.name} onChange={(event) => setTerminalDialog({ ...terminalDialog, name: event.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Location</Label>
                <Input value={terminalDialog.location} onChange={(event) => setTerminalDialog({ ...terminalDialog, location: event.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Latitude</Label>
                <Input value={terminalDialog.latitude} onChange={(event) => setTerminalDialog({ ...terminalDialog, latitude: event.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Longitude</Label>
                <Input value={terminalDialog.longitude} onChange={(event) => setTerminalDialog({ ...terminalDialog, longitude: event.target.value })} />
              </div>
              {terminalDialog.id ? (
                <div className="space-y-2 md:col-span-2">
                  <Label>Capacity</Label>
                  <Input value={terminalDialog.capacity} onChange={(event) => setTerminalDialog({ ...terminalDialog, capacity: event.target.value })} />
                </div>
              ) : null}
              <div className="space-y-2 md:col-span-2">
                <Label>Audit Reason</Label>
                <Textarea value={terminalDialog.reason} onChange={(event) => setTerminalDialog({ ...terminalDialog, reason: event.target.value })} rows={3} />
              </div>
            </div>
          ) : null}
          <DialogFooter>
            <Button variant="outline" onClick={() => setTerminalDialog(null)} disabled={savingTerminal}>
              Cancel
            </Button>
            <Button onClick={() => void handleTerminalSave()} disabled={savingTerminal || !terminalDialog || terminalDialog.reason.trim().length < 5}>
              <PendingButtonContent pending={savingTerminal} label="Save Terminal" />
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
