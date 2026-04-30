'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppHeader } from '@/components/app-header';
import { FilterBar } from '@/components/admin/filter-bar';
import { PageHeader } from '@/components/admin/page-header';
import { SummaryStrip } from '@/components/admin/summary-strip';
import { TableSurface } from '@/components/admin/table-surface';
import { ListCardSkeleton, PageHeaderSkeleton } from '@/components/dashboard/loading-skeletons';
import { InlineErrorState } from '@/components/page-state';
import { SidebarLayout } from '@/components/sidebar-layout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import {
  createSuperadminSupportAccessLog,
  getSuperadminPlatformAuditData,
  getSuperadminSupportAccessData,
  type SuperadminPlatformAuditData,
  type SuperadminSupportAccessData,
} from '@/lib/dashboard/client';
import { useStore } from '@/lib/store-context';
import { getSuperadminSidebarItems } from '@/lib/superadmin-navigation';

type GovernanceTab = 'support' | 'audit';

export default function SuperadminSettingsPage() {
  const { currentUser } = useStore();
  const [supportData, setSupportData] = useState<SuperadminSupportAccessData | null>(null);
  const [auditData, setAuditData] = useState<SuperadminPlatformAuditData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<GovernanceTab>('support');
  const [tenantId, setTenantId] = useState('');
  const [accessType, setAccessType] = useState('tenant_review');
  const [reason, setReason] = useState('');
  const [filterTenantId, setFilterTenantId] = useState('all');
  const [filterAccessType, setFilterAccessType] = useState('all');
  const [auditTenantId, setAuditTenantId] = useState('all');
  const [auditModule, setAuditModule] = useState('all');
  const [auditAction, setAuditAction] = useState('all');
  const loadingRef = useRef(false);

  const sidebarItems = useMemo(() => getSuperadminSidebarItems(), []);

  const loadData = useCallback(async () => {
    if (loadingRef.current) return;
    loadingRef.current = true;
    try {
      const [supportResponse, auditResponse] = await Promise.all([
        getSuperadminSupportAccessData(),
        getSuperadminPlatformAuditData(),
      ]);
      setSupportData(supportResponse);
      setAuditData(auditResponse);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load governance logs.');
    } finally {
      loadingRef.current = false;
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (currentUser?.role === 'superadmin') {
      void loadData();
    }
  }, [currentUser?.role, loadData]);

  const filteredSupportLogs = useMemo(() => {
    const logs = supportData?.logs ?? [];
    return logs.filter((log) => {
      if (filterTenantId !== 'all' && log.tenant.id !== filterTenantId) return false;
      if (filterAccessType !== 'all' && log.accessType !== filterAccessType) return false;
      return true;
    });
  }, [filterAccessType, filterTenantId, supportData?.logs]);

  const accessTypes = useMemo(
    () => Array.from(new Set((supportData?.logs ?? []).map((log) => log.accessType).concat(accessType))).sort(),
    [accessType, supportData?.logs]
  );

  const filteredAuditLogs = useMemo(() => {
    const logs = auditData?.logs ?? [];
    return logs.filter((log) => {
      if (auditTenantId !== 'all' && log.tenant?.id !== auditTenantId) return false;
      if (auditModule !== 'all' && log.module !== auditModule) return false;
      if (auditAction !== 'all' && log.action !== auditAction) return false;
      return true;
    });
  }, [auditAction, auditData?.logs, auditModule, auditTenantId]);

  const auditModules = useMemo(
    () => Array.from(new Set((auditData?.logs ?? []).map((log) => log.module))).sort(),
    [auditData?.logs]
  );
  const auditActions = useMemo(
    () => Array.from(new Set((auditData?.logs ?? []).map((log) => log.action))).sort(),
    [auditData?.logs]
  );

  if (!currentUser || currentUser.role !== 'superadmin') {
    return (
      <div className="space-y-6 p-6">
        <PageHeaderSkeleton />
        <ListCardSkeleton itemCount={3} />
      </div>
    );
  }

  const handleCreateLog = async () => {
    if (!tenantId || reason.trim().length < 5 || saving) return;

    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      await createSuperadminSupportAccessLog({
        tenantId,
        accessType,
        reason: reason.trim(),
      });
      setNotice('Support access recorded.');
      setReason('');
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to record support access.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <AppHeader />
      <div className="mx-auto max-w-7xl px-4 pb-8">
        <SidebarLayout title="Superadmin Menu" items={sidebarItems}>
          <div className="space-y-6">
            <PageHeader
              eyebrow="Governance"
              title="Settings"
              description="Keep support interventions explicit and review the full platform audit trail from one governance workspace."
            />

            {error ? (
              <InlineErrorState
                message={error}
                onRetry={() => void loadData()}
                retryLabel="Retry governance data"
              />
            ) : null}
            {notice ? <p className="text-sm text-muted-foreground">{notice}</p> : null}

            {loading ? (
              <ListCardSkeleton itemCount={3} />
            ) : (
              <>
                <SummaryStrip
                  items={[
                    { label: 'Support Logs', value: supportData?.logs.length ?? 0, meta: `${filteredSupportLogs.length} shown` },
                    { label: 'Platform Audit', value: auditData?.logs.length ?? 0, meta: `${filteredAuditLogs.length} shown` },
                    { label: 'Tenants', value: supportData?.tenants.length ?? 0, meta: 'Governed workspaces' },
                    { label: 'Access Types', value: accessTypes.length, emphasized: true },
                  ]}
                />

                <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as GovernanceTab)} className="space-y-6">
                  <TabsList className="h-auto rounded-2xl">
                    <TabsTrigger value="support">Support Access</TabsTrigger>
                    <TabsTrigger value="audit">Platform Audit</TabsTrigger>
                  </TabsList>

                  <TabsContent value="support" className="space-y-6">
                    <TableSurface
                      title="Record Support Access"
                      description="Every intervention should be logged with a tenant and clear reason."
                    >
                      <div className="grid gap-4 md:grid-cols-3">
                        <div className="space-y-2">
                          <Label>Tenant</Label>
                          <Select value={tenantId} onValueChange={setTenantId}>
                            <SelectTrigger>
                              <SelectValue placeholder="Select tenant" />
                            </SelectTrigger>
                            <SelectContent>
                              {(supportData?.tenants ?? []).map((tenant) => (
                                <SelectItem key={tenant.id} value={tenant.id}>
                                  {tenant.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label>Access Type</Label>
                          <Select value={accessType} onValueChange={setAccessType}>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="tenant_review">Tenant Review</SelectItem>
                              <SelectItem value="settings_support">Settings Support</SelectItem>
                              <SelectItem value="team_support">Team Support</SelectItem>
                              <SelectItem value="driver_support">Driver Support</SelectItem>
                              <SelectItem value="toda_support">TODA Support</SelectItem>
                              <SelectItem value="passenger_support">Passenger Support</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="flex items-end">
                          <Button
                            className="w-full"
                            onClick={() => void handleCreateLog()}
                            disabled={saving || !tenantId || reason.trim().length < 5}
                          >
                            {saving ? 'Saving...' : 'Record Access'}
                          </Button>
                        </div>
                        <div className="space-y-2 md:col-span-3">
                          <Label htmlFor="support-reason">Reason</Label>
                          <Textarea
                            id="support-reason"
                            value={reason}
                            onChange={(event) => setReason(event.target.value)}
                            rows={4}
                            placeholder="Explain why superadmin support or intervention is required."
                          />
                        </div>
                      </div>
                    </TableSurface>

                    <TableSurface
                      title="Support Access Log"
                      description="Review recorded intervention history across tenant workspaces."
                      bodyClassName="pt-0"
                    >
                      <FilterBar className="mb-4 border-0 bg-transparent px-0 py-4 shadow-none backdrop-blur-0">
                        <div className="grid gap-3 md:grid-cols-2">
                          <div className="space-y-2">
                            <Label>Filter Tenant</Label>
                            <Select value={filterTenantId} onValueChange={setFilterTenantId}>
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="all">All Tenants</SelectItem>
                                {(supportData?.tenants ?? []).map((tenant) => (
                                  <SelectItem key={tenant.id} value={tenant.id}>
                                    {tenant.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-2">
                            <Label>Filter Access Type</Label>
                            <Select value={filterAccessType} onValueChange={setFilterAccessType}>
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="all">All Access Types</SelectItem>
                                {accessTypes.map((type) => (
                                  <SelectItem key={type} value={type}>
                                    {type}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                      </FilterBar>

                      {filteredSupportLogs.length === 0 ? (
                        <div className="pb-6 text-sm text-muted-foreground">
                          No support access logs match the current filters.
                        </div>
                      ) : (
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>When</TableHead>
                              <TableHead>Tenant</TableHead>
                              <TableHead>Access Type</TableHead>
                              <TableHead>Super Admin</TableHead>
                              <TableHead>Reason</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {filteredSupportLogs.map((log) => (
                              <TableRow key={log.id}>
                                <TableCell>{new Date(log.createdAt).toLocaleString()}</TableCell>
                                <TableCell>
                                  <div className="space-y-1">
                                    <p className="font-medium text-foreground">{log.tenant.name}</p>
                                    <p className="text-xs text-muted-foreground">{log.tenant.lguName}</p>
                                  </div>
                                </TableCell>
                                <TableCell>{log.accessType}</TableCell>
                                <TableCell>{log.superAdmin.name}</TableCell>
                                <TableCell className="max-w-[360px] whitespace-normal text-sm text-muted-foreground">
                                  {log.reason}
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      )}
                    </TableSurface>
                  </TabsContent>

                  <TabsContent value="audit" className="space-y-6">
                    <TableSurface
                      title="Platform Audit Log"
                      description="Every superadmin write funnels here, including passenger corrections, tenant lifecycle changes, and configuration updates."
                      bodyClassName="pt-0"
                    >
                      <FilterBar className="mb-4 border-0 bg-transparent px-0 py-4 shadow-none backdrop-blur-0">
                        <div className="grid gap-3 md:grid-cols-3">
                          <div className="space-y-2">
                            <Label>Tenant</Label>
                            <Select value={auditTenantId} onValueChange={setAuditTenantId}>
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="all">All Tenants</SelectItem>
                                {(auditData?.tenants ?? []).map((tenant) => (
                                  <SelectItem key={tenant.id} value={tenant.id}>
                                    {tenant.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-2">
                            <Label>Module</Label>
                            <Select value={auditModule} onValueChange={setAuditModule}>
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="all">All Modules</SelectItem>
                                {auditModules.map((module) => (
                                  <SelectItem key={module} value={module}>
                                    {module}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-2">
                            <Label>Action</Label>
                            <Select value={auditAction} onValueChange={setAuditAction}>
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="all">All Actions</SelectItem>
                                {auditActions.map((action) => (
                                  <SelectItem key={action} value={action}>
                                    {action}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                      </FilterBar>

                      {filteredAuditLogs.length === 0 ? (
                        <div className="pb-6 text-sm text-muted-foreground">
                          No platform audit entries match the current filters.
                        </div>
                      ) : (
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>When</TableHead>
                              <TableHead>Tenant</TableHead>
                              <TableHead>Module</TableHead>
                              <TableHead>Action</TableHead>
                              <TableHead>Actor</TableHead>
                              <TableHead>Reason</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {filteredAuditLogs.map((log) => (
                              <TableRow key={log.id}>
                                <TableCell>{new Date(log.createdAt).toLocaleString()}</TableCell>
                                <TableCell>
                                  {log.tenant ? (
                                    <div className="space-y-1">
                                      <p className="font-medium">{log.tenant.name}</p>
                                      <p className="text-xs text-muted-foreground">{log.tenant.lguName}</p>
                                    </div>
                                  ) : (
                                    <span className="text-sm text-muted-foreground">Platform</span>
                                  )}
                                </TableCell>
                                <TableCell>{log.module}</TableCell>
                                <TableCell>
                                  <div className="space-y-1">
                                    <p>{log.action}</p>
                                    <p className="text-xs text-muted-foreground">
                                      {log.targetType}
                                      {log.targetId ? `: ${log.targetId}` : ''}
                                    </p>
                                  </div>
                                </TableCell>
                                <TableCell>{log.actor.name}</TableCell>
                                <TableCell className="max-w-[360px] whitespace-normal text-sm text-muted-foreground">
                                  {log.reason}
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      )}
                    </TableSurface>
                  </TabsContent>
                </Tabs>
              </>
            )}
          </div>
        </SidebarLayout>
      </div>
    </>
  );
}
