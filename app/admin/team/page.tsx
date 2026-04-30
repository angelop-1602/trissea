'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Search, UserPlus } from 'lucide-react';
import { AppHeader } from '@/components/app-header';
import { FilterBar } from '@/components/admin/filter-bar';
import { PageHeader } from '@/components/admin/page-header';
import { SummaryStrip } from '@/components/admin/summary-strip';
import { TableSurface } from '@/components/admin/table-surface';
import { PageHeaderSkeleton, SearchBarSkeleton, TableCardSkeleton } from '@/components/dashboard/loading-skeletons';
import { InlineErrorState } from '@/components/page-state';
import { SidebarLayout } from '@/components/sidebar-layout';
import { Badge } from '@/components/ui/badge';
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { getAdminSidebarItems } from '@/lib/admin-navigation';
import {
  getAdminTenantTeamData,
  inviteAdminTenantTeamMember,
  updateAdminTenantTeamMember,
  type AdminTenantRoleOption,
  type AdminTenantTeamData,
} from '@/lib/dashboard/client';
import { useStore } from '@/lib/store-context';

function formatDate(value: string | Date) {
  return new Intl.DateTimeFormat('en-PH', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(value));
}

function roleBadgeClass(roleKey: string) {
  if (roleKey === 'tenant_owner') return 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/15 dark:text-emerald-200';
  if (roleKey === 'tenant_admin') return 'border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-500/30 dark:bg-blue-500/15 dark:text-blue-200';
  if (roleKey === 'dispatcher') return 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/15 dark:text-amber-200';
  if (roleKey === 'driver_reviewer') return 'border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-500/30 dark:bg-violet-500/15 dark:text-violet-200';
  return 'border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-500/30 dark:bg-slate-500/15 dark:text-slate-200';
}

export default function AdminTenantTeamPage() {
  const { currentUser, currentTenant, currentTenantSettings } = useStore();
  const [data, setData] = useState<AdminTenantTeamData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isInviteOpen, setIsInviteOpen] = useState(false);
  const [inviteName, setInviteName] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRoleKey, setInviteRoleKey] = useState('tenant_admin');
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [inviteNotice, setInviteNotice] = useState<{ email: string; temporaryPassword: string } | null>(null);
  const [savingMemberId, setSavingMemberId] = useState<string | null>(null);
  const [isInviting, setIsInviting] = useState(false);
  const loadingRef = useRef(false);

  const canLoad = currentUser?.role === 'admin' && Boolean(currentTenant);

  const loadData = useCallback(async () => {
    if (!canLoad || loadingRef.current) return;
    loadingRef.current = true;
    try {
      const response = await getAdminTenantTeamData();
      setData(response);
      setError(null);
      if (!response.roles.some((role) => role.key === inviteRoleKey) && response.roles[0]) {
        setInviteRoleKey(response.roles[0].key);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load tenant team.');
    } finally {
      loadingRef.current = false;
      setLoading(false);
    }
  }, [canLoad, inviteRoleKey]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const sidebarItems = getAdminSidebarItems();

  if (!currentUser || currentUser.role !== 'admin' || !currentTenant) {
    return (
      <div className="space-y-6 p-6">
        <PageHeaderSkeleton withAction />
        <TableCardSkeleton columnCount={6} />
      </div>
    );
  }

  const permissions = new Set(data?.currentUserPermissions ?? []);
  const canViewTeam = permissions.has('tenant.team.view');
  const canInvite = permissions.has('tenant.team.invite');
  const canManageRoles = permissions.has('tenant.team.roles.manage');
  const canManageStatus = permissions.has('tenant.team.members.manage_status');
  const roles = data?.roles ?? [];
  const members = data?.members ?? [];
  const denseTables = currentTenantSettings?.uiPreferences.denseTables ?? false;

  const filteredMembers = useMemo(() => {
    const normalized = searchQuery.trim().toLowerCase();
    if (!normalized) return members;

    return members.filter((member) =>
      [member.name, member.email ?? '', member.tenantRoleName, member.tenantRoleKey, member.isActive ? 'active' : 'inactive']
        .join(' ')
        .toLowerCase()
        .includes(normalized)
    );
  }, [members, searchQuery]);
  const activeMembers = members.filter((member) => member.isActive).length;
  const inactiveMembers = members.length - activeMembers;
  const ownerCount = members.filter((member) => member.tenantRoleKey === 'tenant_owner').length;

  const resetInviteForm = () => {
    setInviteName('');
    setInviteEmail('');
    setInviteRoleKey(roles[0]?.key ?? 'tenant_admin');
    setInviteError(null);
  };

  const handleInvite = async () => {
    if (!canInvite || isInviting) return;

    setIsInviting(true);
    setInviteError(null);

    try {
      const response = await inviteAdminTenantTeamMember({
        name: inviteName,
        email: inviteEmail,
        tenantRoleKey: inviteRoleKey,
      });

      setData((prev) =>
        prev
          ? {
              ...prev,
              members: [response.member, ...prev.members.filter((member) => member.id !== response.member.id)],
            }
          : prev
      );
      setInviteNotice({
        email: response.member.email ?? inviteEmail,
        temporaryPassword: response.temporaryPassword,
      });
      setIsInviteOpen(false);
      resetInviteForm();
    } catch (err) {
      setInviteError(err instanceof Error ? err.message : 'Failed to invite team member.');
    } finally {
      setIsInviting(false);
    }
  };

  const handleMemberUpdate = async (
    membershipId: string,
    payload: { tenantRoleKey?: string; isActive?: boolean }
  ) => {
    if (savingMemberId) return;

    setSavingMemberId(membershipId);
    setError(null);

    try {
      const response = await updateAdminTenantTeamMember(membershipId, payload);
      setData((prev) =>
        prev
          ? {
              ...prev,
              members: prev.members.map((member) => (member.id === membershipId ? response.member : member)),
            }
          : prev
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update team member.');
    } finally {
      setSavingMemberId(null);
    }
  };

  return (
    <>
      <AppHeader />
      <div className="max-w-7xl mx-auto px-4 pb-8">
        <SidebarLayout title="Admin Menu" items={sidebarItems}>
          <div className="space-y-6">
            {loading ? (
              <>
                <PageHeaderSkeleton withAction />
                <div className="flex w-full max-w-xl flex-col gap-3 sm:flex-row">
                  <SearchBarSkeleton className="flex-1" />
                </div>
              </>
            ) : (
              <>
                <div className="space-y-4">
                  <PageHeader
                    eyebrow="Tenant Workforce"
                    title="Tenant Team"
                    description={`Manage tenant staff memberships, roles, and activation state for ${currentTenant.name}.`}
                  />

                  <FilterBar>
                    <div className="flex w-full flex-col gap-3 sm:flex-row sm:items-center">
                      <div className="relative flex-1">
                        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                        <Input
                          value={searchQuery}
                          onChange={(event) => setSearchQuery(event.target.value)}
                          placeholder="Search team members by name, email, role, or status"
                          className="pl-9"
                        />
                      </div>

                      <Dialog
                        open={isInviteOpen}
                        onOpenChange={(open) => {
                          setIsInviteOpen(open);
                          if (!open) resetInviteForm();
                        }}
                      >
                        <DialogTrigger asChild>
                          <Button disabled={!canInvite}>
                            <UserPlus className="h-4 w-4" />
                            Invite Member
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="sm:max-w-xl">
                          <DialogHeader>
                            <DialogTitle>Invite Tenant Team Member</DialogTitle>
                            <DialogDescription>
                              Create or reactivate a tenant staff account, then assign its tenant-scoped role.
                            </DialogDescription>
                          </DialogHeader>

                          <div className="space-y-4">
                            <div className="space-y-2">
                              <Label htmlFor="invite-name">Full name</Label>
                              <Input
                                id="invite-name"
                                value={inviteName}
                                onChange={(event) => setInviteName(event.target.value)}
                                placeholder="e.g. Maria Santos"
                              />
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor="invite-email">Email</Label>
                              <Input
                                id="invite-email"
                                value={inviteEmail}
                                onChange={(event) => setInviteEmail(event.target.value)}
                                placeholder="name@example.com"
                                type="email"
                              />
                            </div>
                            <div className="space-y-2">
                              <Label>Tenant role</Label>
                              <Select value={inviteRoleKey} onValueChange={setInviteRoleKey}>
                                <SelectTrigger>
                                  <SelectValue placeholder="Select tenant role" />
                                </SelectTrigger>
                                <SelectContent>
                                  {roles.map((role) => (
                                    <SelectItem key={role.key} value={role.key}>
                                      {role.name}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              <p className="text-xs text-muted-foreground">
                                {roles.find((role) => role.key === inviteRoleKey)?.description ?? 'Select the role this staff member should have.'}
                              </p>
                            </div>
                            {inviteError ? <p className="text-sm text-destructive">{inviteError}</p> : null}
                          </div>

                          <DialogFooter>
                            <Button variant="outline" onClick={() => setIsInviteOpen(false)} disabled={isInviting}>
                              Cancel
                            </Button>
                            <Button onClick={() => void handleInvite()} disabled={isInviting}>
                              {isInviting ? 'Inviting...' : 'Create Invite'}
                            </Button>
                          </DialogFooter>
                        </DialogContent>
                      </Dialog>
                    </div>
                  </FilterBar>
                </div>

                {inviteNotice ? (
                  <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900 dark:border-emerald-500/30 dark:bg-emerald-500/15 dark:text-emerald-100">
                    Temporary access created for <span className="font-semibold">{inviteNotice.email}</span>. Initial password:
                    {' '}
                    <span className="font-mono font-semibold">{inviteNotice.temporaryPassword}</span>
                  </div>
                ) : null}

                {error ? (
                  <InlineErrorState
                    message={error}
                    onRetry={() => void loadData()}
                    retryLabel="Retry tenant team"
                  />
                ) : null}

                <SummaryStrip
                  items={[
                    { label: 'Members', value: members.length, meta: `${filteredMembers.length} shown` },
                    { label: 'Active', value: activeMembers, meta: 'Can access tenant workspace' },
                    { label: 'Inactive', value: inactiveMembers, meta: 'Deactivated memberships' },
                    { label: 'Owners', value: ownerCount, meta: 'Protected tenant owners', emphasized: true },
                  ]}
                />
              </>
            )}

            <TableSurface
              title="Current Tenant Team"
              description={`${filteredMembers.length} member${filteredMembers.length === 1 ? '' : 's'} shown in this tenant workspace.`}
              actions={
                !canViewTeam && !loading ? (
                  <Badge variant="outline" className="border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/15 dark:text-amber-200">
                    View permission required
                  </Badge>
                ) : null
              }
              bodyClassName="pt-0"
            >
              {loading ? (
                <TableCardSkeleton columnCount={6} rowCount={7} showCardHeader={false} />
              ) : !canViewTeam ? (
                <div className="flex h-40 items-center justify-center px-4 text-sm text-muted-foreground">
                  Your tenant role does not include permission to view team memberships.
                </div>
              ) : filteredMembers.length === 0 ? (
                <div className="flex h-40 items-center justify-center px-4 text-sm text-muted-foreground">
                  No tenant team members match the current search.
                </div>
              ) : (
                <Table className={denseTables ? 'text-xs' : undefined}>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Member</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Invited By</TableHead>
                      <TableHead>Joined</TableHead>
                      <TableHead className="w-[260px]">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredMembers.map((member) => (
                      <TableRow key={member.id} className={denseTables ? '[&>td]:py-1.5' : undefined}>
                        <TableCell>
                          <div className="space-y-1">
                            <p className="font-medium">{member.name}</p>
                            <p className="text-xs text-muted-foreground">{member.email ?? 'No email on file'}</p>
                          </div>
                        </TableCell>
                        <TableCell>
                          {canManageRoles ? (
                            <Select
                              value={member.tenantRoleKey}
                              onValueChange={(value) => void handleMemberUpdate(member.id, { tenantRoleKey: value })}
                              disabled={savingMemberId === member.id}
                            >
                              <SelectTrigger className="w-[180px]">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {roles.map((role: AdminTenantRoleOption) => (
                                  <SelectItem key={role.key} value={role.key}>
                                    {role.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          ) : (
                            <Badge variant="outline" className={roleBadgeClass(member.tenantRoleKey)}>
                              {member.tenantRoleName}
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className={
                              member.isActive
                                ? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/15 dark:text-emerald-200'
                                : 'border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-500/30 dark:bg-slate-500/15 dark:text-slate-200'
                            }
                          >
                            {member.isActive ? 'Active' : 'Inactive'}
                          </Badge>
                        </TableCell>
                        <TableCell>{member.invitedByName ?? 'Seeded / legacy'}</TableCell>
                        <TableCell>{formatDate(member.createdAt)}</TableCell>
                        <TableCell>
                          <div className="flex justify-end gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              disabled={!canManageStatus || savingMemberId === member.id}
                              onClick={() => void handleMemberUpdate(member.id, { isActive: !member.isActive })}
                            >
                              {member.isActive ? 'Deactivate' : 'Reactivate'}
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
    </>
  );
}
