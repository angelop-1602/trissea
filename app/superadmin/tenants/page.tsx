'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowRightLeft, Check, Search } from 'lucide-react';
import { useStore } from '@/lib/store-context';
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
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PendingButtonContent } from '@/components/ui/pending-button-content';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import {
  createSuperadminTenant,
  getSuperadminTenantsData,
  type SuperadminTenantRow,
  type SuperadminTenantsData,
  updateSuperadminTenant,
} from '@/lib/dashboard/client';
import { getSuperadminSidebarItems } from '@/lib/superadmin-navigation';

type LGUOption = {
  code: string;
  name: string;
  lguType: 'province' | 'city' | 'municipality';
  regionCode: string | null;
  regionName: string | null;
  provinceCode: string | null;
  provinceName: string | null;
};

const LGU_TYPE_LABEL: Record<LGUOption['lguType'], string> = {
  province: 'Province',
  city: 'City',
  municipality: 'Municipality',
};

function formatCurrency(value: number) {
  return new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: 'PHP',
    maximumFractionDigits: 0,
  }).format(value);
}

function formatTenantStatus(status: SuperadminTenantRow['status']) {
  return status === 'suspended' ? 'Suspended' : 'Active';
}

export default function SuperadminTenantsPage() {
  const { currentUser } = useStore();
  const [data, setData] = useState<SuperadminTenantsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'suspended'>('all');
  const [regionFilter, setRegionFilter] = useState('all');
  const loadingRef = useRef(false);

  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [lguQuery, setLguQuery] = useState('');
  const [lguOptions, setLguOptions] = useState<LGUOption[]>([]);
  const [lguLoading, setLguLoading] = useState(false);
  const [selectedLgu, setSelectedLgu] = useState<LGUOption | null>(null);
  const [createReason, setCreateReason] = useState('');
  const [createError, setCreateError] = useState<string | null>(null);
  const [creatingTenant, setCreatingTenant] = useState(false);
  const [createdCredentials, setCreatedCredentials] = useState<{ email: string; temporaryPassword: string } | null>(
    null
  );

  const [actionTenant, setActionTenant] = useState<SuperadminTenantRow | null>(null);
  const [actionReason, setActionReason] = useState('');
  const [suspensionReason, setSuspensionReason] = useState('');
  const [isStatusSaving, setIsStatusSaving] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const canLoad = currentUser?.role === 'superadmin';

  const loadData = useCallback(async () => {
    if (!canLoad || loadingRef.current) return;
    loadingRef.current = true;

    try {
      const response = await getSuperadminTenantsData({
        query: searchQuery.trim() || undefined,
        regionCode: regionFilter === 'all' ? undefined : regionFilter,
        status: statusFilter,
      });
      setData(response);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load tenants.');
    } finally {
      loadingRef.current = false;
      setLoading(false);
    }
  }, [canLoad, regionFilter, searchQuery, statusFilter]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const loadLgus = useCallback(async (query: string) => {
    setLguLoading(true);

    try {
      const response = await fetch(`/api/psgc/lgus?q=${encodeURIComponent(query)}`, {
        cache: 'no-store',
      });
      const payload = (await response.json().catch(() => ({}))) as {
        lgus?: LGUOption[];
        error?: string;
      };

      if (!response.ok) {
        throw new Error(payload.error ?? 'Failed to load LGUs.');
      }

      setLguOptions(payload.lgus ?? []);
      setCreateError(null);
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : 'Failed to load LGUs.');
      setLguOptions([]);
    } finally {
      setLguLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!showCreateDialog) {
      return;
    }

    const timer = setTimeout(() => {
      void loadLgus(lguQuery.trim());
    }, 250);

    return () => clearTimeout(timer);
  }, [lguQuery, loadLgus, showCreateDialog]);

  const sidebarItems = useMemo(() => getSuperadminSidebarItems(), []);

  const resetCreateDialog = () => {
    setSelectedLgu(null);
    setLguQuery('');
    setCreateReason('');
    setCreateError(null);
  };

  const handleCreateTenant = async () => {
    if (!selectedLgu || createReason.trim().length < 5 || creatingTenant) return;

    setCreatingTenant(true);
    setCreateError(null);

    try {
      const response = await createSuperadminTenant({
        lguCode: selectedLgu.code,
        reason: createReason.trim(),
      });
      setCreatedCredentials(response.credentials);
      setShowCreateDialog(false);
      resetCreateDialog();
      await loadData();
      setNotice(`Tenant ${response.tenant.name} created.`);
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : 'Failed to create tenant.');
    } finally {
      setCreatingTenant(false);
    }
  };

  const handleTenantStatusUpdate = async () => {
    if (!actionTenant || actionReason.trim().length < 5 || isStatusSaving) return;

    setIsStatusSaving(true);
    setError(null);

    try {
      const nextStatus = actionTenant.status === 'suspended' ? 'active' : 'suspended';
      await updateSuperadminTenant(actionTenant.id, {
        reason: actionReason.trim(),
        status: nextStatus,
        suspensionReason: nextStatus === 'suspended' ? suspensionReason.trim() || null : null,
      });
      setActionTenant(null);
      setActionReason('');
      setSuspensionReason('');
      setNotice(`${actionTenant.name} is now ${nextStatus}.`);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update tenant status.');
    } finally {
      setIsStatusSaving(false);
    }
  };

  if (!currentUser || currentUser.role !== 'superadmin') {
    return (
      <div className="space-y-6 p-6">
        <PageHeaderSkeleton withAction />
        <FilterBarSkeleton count={3} />
        <ListCardSkeleton itemCount={5} />
      </div>
    );
  }

  const tenants = data?.tenants ?? [];
  const activeTenants = tenants.filter((tenant) => tenant.status === 'active').length;
  const suspendedTenants = tenants.filter((tenant) => tenant.status === 'suspended').length;
  const totalPassengers = tenants.reduce((sum, tenant) => sum + tenant.passengers, 0);

  return (
    <>
      <AppHeader />
      <div className="max-w-7xl mx-auto px-4 pb-8">
        <SidebarLayout title="Superadmin Menu" items={sidebarItems}>
          <div className="space-y-6">
            {loading ? (
              <>
                <PageHeaderSkeleton withAction />
                <FilterBarSkeleton count={3} />
                <ListCardSkeleton itemCount={5} />
              </>
            ) : (
              <>
                <PageHeader
                  eyebrow="Platform Tenancy"
                  title="Tenants"
                  description="Filter, create, and control tenant workspaces from one platform-level directory."
                  actions={
                    <Dialog
                      open={showCreateDialog}
                      onOpenChange={(open) => {
                        setShowCreateDialog(open);
                        if (!open) {
                          resetCreateDialog();
                        }
                      }}
                    >
                      <DialogTrigger asChild>
                        <Button>Create Tenant</Button>
                      </DialogTrigger>
                      <DialogContent className="sm:max-w-2xl">
                        <DialogHeader>
                          <DialogTitle>Create Tenant Workspace</DialogTitle>
                          <DialogDescription>
                            Provision a new tenant from a PSGC LGU and issue the initial tenant-admin credentials.
                          </DialogDescription>
                        </DialogHeader>

                        <div className="space-y-4">
                          <div className="space-y-2">
                            <Label>Search LGU</Label>
                            <Input
                              placeholder="Type province, city, or municipality"
                              value={lguQuery}
                              onChange={(event) => setLguQuery(event.target.value)}
                            />
                          </div>

                          <div className="max-h-64 overflow-y-auto rounded-xl border">
                            {lguLoading ? (
                              <div className="space-y-2 p-3">
                                {Array.from({ length: 4 }).map((_, index) => (
                                  <div key={index} className="rounded-lg border p-3">
                                    <Skeleton className="h-4 w-40" />
                                    <Skeleton className="mt-2 h-3 w-56" />
                                  </div>
                                ))}
                              </div>
                            ) : lguOptions.length === 0 ? (
                              <div className="p-4 text-sm text-muted-foreground">No LGU results yet.</div>
                            ) : (
                              lguOptions.map((lgu) => {
                                const selected = selectedLgu?.code === lgu.code;
                                return (
                                  <button
                                    key={lgu.code}
                                    type="button"
                                    className={`w-full border-b px-3 py-3 text-left last:border-b-0 hover:bg-muted/40 ${
                                      selected ? 'bg-primary/10' : ''
                                    }`}
                                    onClick={() => setSelectedLgu(lgu)}
                                  >
                                    <p className="flex items-center gap-2 text-sm font-medium">
                                      {selected ? <Check className="h-4 w-4 text-primary" /> : null}
                                      {lgu.name}
                                      <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
                                        {LGU_TYPE_LABEL[lgu.lguType]}
                                      </span>
                                    </p>
                                    <p className="mt-1 text-xs text-muted-foreground">
                                      {lgu.regionName ?? 'Unknown region'}
                                      {lgu.provinceName ? ` | ${lgu.provinceName}` : ''}
                                    </p>
                                  </button>
                                );
                              })
                            )}
                          </div>

                          <div className="space-y-2">
                            <Label htmlFor="create-tenant-reason">Reason</Label>
                            <Textarea
                              id="create-tenant-reason"
                              value={createReason}
                              onChange={(event) => setCreateReason(event.target.value)}
                              rows={3}
                              placeholder="Explain why this tenant is being provisioned."
                            />
                          </div>

                          {createError ? <p className="text-sm text-destructive">{createError}</p> : null}
                        </div>

                        <DialogFooter>
                          <Button variant="outline" onClick={() => setShowCreateDialog(false)} disabled={creatingTenant}>
                            Cancel
                          </Button>
                          <Button
                            onClick={() => void handleCreateTenant()}
                            disabled={!selectedLgu || createReason.trim().length < 5 || creatingTenant}
                          >
                            <PendingButtonContent pending={creatingTenant} label="Create Tenant" />
                          </Button>
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>
                  }
                />

                <FilterBar>
                  <div className="grid gap-3 md:grid-cols-[minmax(0,1.3fr)_220px_220px]">
                    <div className="space-y-2">
                      <Label>Search</Label>
                      <div className="relative">
                        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                        <Input
                          value={searchQuery}
                          onChange={(event) => setSearchQuery(event.target.value)}
                          className="pl-9"
                          placeholder="Search tenant, LGU, province, or region"
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>Status</Label>
                      <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as typeof statusFilter)}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All statuses</SelectItem>
                          <SelectItem value="active">Active</SelectItem>
                          <SelectItem value="suspended">Suspended</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Region</Label>
                      <Select value={regionFilter} onValueChange={setRegionFilter}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All regions</SelectItem>
                          {(data?.regions ?? []).map((region) => (
                            <SelectItem key={region.code} value={region.code}>
                              {region.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </FilterBar>

                {notice ? (
                  <p className="rounded-xl border border-primary/25 bg-primary/10 px-4 py-3 text-sm text-primary">
                    {notice}
                  </p>
                ) : null}

                {createdCredentials ? (
                  <div className="rounded-xl border border-emerald-300/50 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-900 dark:text-emerald-100">
                    <p className="font-medium">Tenant-admin credentials created.</p>
                    <p>Email: {createdCredentials.email}</p>
                    <p>Temporary password: {createdCredentials.temporaryPassword}</p>
                  </div>
                ) : null}

                {error ? (
                  <InlineErrorState
                    message={error}
                    onRetry={() => void loadData()}
                    retryLabel="Retry tenants"
                  />
                ) : null}

                <SummaryStrip
                  items={[
                    { label: 'Tenants', value: tenants.length },
                    { label: 'Active', value: activeTenants },
                    { label: 'Suspended', value: suspendedTenants },
                    { label: 'Passengers', value: totalPassengers, emphasized: true },
                  ]}
                />
              </>
            )}

            <TableSurface
              title="Tenant Directory"
              description="Platform-managed tenant workspaces with real lifecycle status and drill-down access."
              bodyClassName="pt-0"
            >
              {loading ? (
                <ListCardSkeleton itemCount={5} />
              ) : tenants.length === 0 ? (
                <div className="py-10 text-center text-sm text-muted-foreground">
                  No tenants match the current filters.
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Tenant</TableHead>
                      <TableHead>Region</TableHead>
                      <TableHead>Users</TableHead>
                      <TableHead>Trips</TableHead>
                      <TableHead>Reservations</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {tenants.map((tenant) => (
                      <TableRow key={tenant.id}>
                        <TableCell>
                          <div className="space-y-1">
                            <p className="font-medium">{tenant.name}</p>
                            <p className="text-xs text-muted-foreground">
                              {tenant.lguName} | {tenant.lguType.toUpperCase()}
                            </p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="space-y-1">
                            <p className="text-sm">{tenant.regionName ?? 'Unknown region'}</p>
                            <p className="text-xs text-muted-foreground">{tenant.provinceName ?? 'No province'}</p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="space-y-1 text-sm">
                            <p>{tenant.users} total</p>
                            <p className="text-xs text-muted-foreground">
                              {tenant.passengers} passengers | {tenant.drivers} drivers
                            </p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="space-y-1 text-sm">
                            <p>{tenant.rides} trips</p>
                            <p className="text-xs text-muted-foreground">{formatCurrency(tenant.revenue)}</p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="space-y-1 text-sm">
                            <p>{tenant.reservations} reservations</p>
                            <p className="text-xs text-muted-foreground">{tenant.terminals} terminals</p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="space-y-1">
                            <p
                              className={`text-sm font-medium ${
                                tenant.status === 'suspended' ? 'text-amber-700' : 'text-emerald-700'
                              }`}
                            >
                              {formatTenantStatus(tenant.status)}
                            </p>
                            {tenant.status === 'suspended' ? (
                              <p className="max-w-[16rem] text-xs text-muted-foreground">
                                {tenant.suspensionReason ?? 'No suspension reason recorded.'}
                              </p>
                            ) : null}
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button asChild size="sm" variant="outline">
                              <Link href={`/superadmin/tenants/${tenant.id}`}>Open</Link>
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setActionTenant(tenant);
                                setActionReason('');
                                setSuspensionReason(tenant.suspensionReason ?? '');
                              }}
                            >
                              <ArrowRightLeft className="h-4 w-4" />
                              {tenant.status === 'suspended' ? 'Activate' : 'Suspend'}
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </TableSurface>
          </div>
        </SidebarLayout>
      </div>

      <Dialog
        open={Boolean(actionTenant)}
        onOpenChange={(open) => {
          if (!open) {
            setActionTenant(null);
            setActionReason('');
            setSuspensionReason('');
          }
        }}
      >
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>{actionTenant?.status === 'suspended' ? 'Activate Tenant' : 'Suspend Tenant'}</DialogTitle>
            <DialogDescription>
              {actionTenant?.status === 'suspended'
                ? `Restore ${actionTenant?.name} so tenant-scoped users can access the workspace again.`
                : `Suspend ${actionTenant?.name} and block tenant-scoped access until platform support reactivates it.`}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {actionTenant?.status !== 'suspended' ? (
              <div className="space-y-2">
                <Label htmlFor="tenant-suspension-reason">Suspension Message</Label>
                <Textarea
                  id="tenant-suspension-reason"
                  rows={3}
                  value={suspensionReason}
                  onChange={(event) => setSuspensionReason(event.target.value)}
                  placeholder="Message shown to blocked tenant users."
                />
              </div>
            ) : null}

            <div className="space-y-2">
              <Label htmlFor="tenant-action-reason">Audit Reason</Label>
              <Textarea
                id="tenant-action-reason"
                rows={3}
                value={actionReason}
                onChange={(event) => setActionReason(event.target.value)}
                placeholder="Explain why this lifecycle action is needed."
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setActionTenant(null)} disabled={isStatusSaving}>
              Cancel
            </Button>
            <Button onClick={() => void handleTenantStatusUpdate()} disabled={actionReason.trim().length < 5 || isStatusSaving}>
              <PendingButtonContent
                pending={isStatusSaving}
                label={actionTenant?.status === 'suspended' ? 'Activate Tenant' : 'Suspend Tenant'}
              />
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
