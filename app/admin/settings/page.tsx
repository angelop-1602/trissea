'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  CircleDollarSign,
  Laptop,
  MapPinned,
  Moon,
  ScrollText,
  Sun,
  type LucideIcon,
} from 'lucide-react';
import { useTheme } from 'next-themes';
import { AppHeader } from '@/components/app-header';
import { PageHeaderSkeleton, SettingsPanelSkeleton } from '@/components/dashboard/loading-skeletons';
import { InlineErrorState } from '@/components/page-state';
import { SidebarLayout } from '@/components/sidebar-layout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { getAdminSidebarItems } from '@/lib/admin-navigation';
import {
  getAdminTerminalsData,
  getAdminTenantAuditLogs,
  getAdminTenantSettingsData,
  updateAdminTenantSettings,
  type AdminTerminalsData,
  type AdminTenantAuditData,
  type TenantSettingsShape,
} from '@/lib/dashboard/client';
import { useStore } from '@/lib/store-context';

type ThemeMode = 'system' | 'light' | 'dark';
type SettingsPanel = 'appearance' | 'pricing' | 'terminals' | 'audit';

type SettingsNavItem = {
  value: SettingsPanel;
  label: string;
  description: string;
  group: string;
  icon: LucideIcon;
};

const PANEL_CLASSNAME =
  'overflow-hidden rounded-[1.75rem] border border-border/70 bg-card/92 shadow-[0_18px_50px_-34px_rgba(0,0,0,0.32)]';

function parseMoneyInput(value: string, fallback: number) {
  const parsed = Number.parseFloat(value);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  return Math.round(parsed * 100) / 100;
}

function getTerminalAdjustmentAmount(settings: TenantSettingsShape, terminalId: string) {
  return (
    settings.operationsPreferences.onDemandFare.terminalAdjustments.find((item) => item.terminalId === terminalId)
      ?.amount ?? 0
  );
}

function updateTerminalAdjustmentList(
  adjustments: TenantSettingsShape['operationsPreferences']['onDemandFare']['terminalAdjustments'],
  terminalId: string,
  amount: number
) {
  const next = adjustments.filter((item) => item.terminalId !== terminalId);
  if (amount === 0) {
    return next;
  }

  return [...next, { terminalId, amount }].sort((left, right) => left.terminalId.localeCompare(right.terminalId));
}

function SettingsLinkButton({
  active,
  item,
  onClick,
}: {
  active: boolean;
  item: SettingsNavItem;
  onClick: () => void;
}) {
  const Icon = item.icon;

  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full cursor-pointer items-start gap-3 rounded-2xl border px-3 py-3 text-left transition-colors duration-200 ${
        active
          ? 'border-primary/20 bg-primary/10 text-foreground'
          : 'border-transparent bg-transparent text-muted-foreground hover:border-border/80 hover:bg-muted/60 hover:text-foreground'
      }`}
    >
      <span
        className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${
          active ? 'bg-primary/15 text-primary' : 'bg-muted/70 text-muted-foreground'
        }`}
      >
        <Icon className="h-4.5 w-4.5" />
      </span>
      <span className="space-y-1">
        <span className="block text-sm font-medium">{item.label}</span>
        <span className="block text-xs leading-5 text-muted-foreground">{item.description}</span>
      </span>
    </button>
  );
}

function ThemeModeCard({
  mode,
  title,
  selected,
  icon: Icon,
  onSelect,
}: {
  mode: ThemeMode;
  title: string;
  selected: boolean;
  icon: LucideIcon;
  onSelect: (mode: ThemeMode) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onSelect(mode)}
      className={`w-full cursor-pointer rounded-[1.4rem] border p-3 text-left transition-colors duration-200 ${
        selected
          ? 'border-primary bg-primary/5 text-foreground'
          : 'border-border/70 bg-background hover:border-primary/35 hover:bg-muted/35'
      }`}
      aria-pressed={selected}
    >
      <div className="relative overflow-hidden rounded-[1.1rem] border border-border/70 bg-background">
        <div className="h-28 w-full">
          {mode === 'light' ? (
            <div className="flex h-full bg-white">
              <div className="w-[28%] border-r border-slate-200 bg-slate-50 p-2">
                <div className="h-2.5 w-12 rounded-full bg-sky-500" />
                <div className="mt-3 space-y-2">
                  <div className="h-2 w-14 rounded-full bg-slate-300" />
                  <div className="h-2 w-12 rounded-full bg-slate-200" />
                  <div className="h-2 w-10 rounded-full bg-slate-200" />
                </div>
              </div>
              <div className="flex-1 bg-sky-50 p-3">
                <div className="grid gap-2">
                  <div className="h-7 rounded-lg bg-sky-100" />
                  <div className="h-7 rounded-lg bg-sky-100" />
                  <div className="h-7 rounded-lg bg-sky-100" />
                </div>
              </div>
            </div>
          ) : null}

          {mode === 'dark' ? (
            <div className="flex h-full bg-zinc-950">
              <div className="w-[28%] border-r border-white/10 bg-zinc-900 p-2">
                <div className="h-2.5 w-12 rounded-full bg-fuchsia-500" />
                <div className="mt-3 space-y-2">
                  <div className="h-2 w-14 rounded-full bg-zinc-600" />
                  <div className="h-2 w-12 rounded-full bg-zinc-700" />
                  <div className="h-2 w-10 rounded-full bg-zinc-700" />
                </div>
              </div>
              <div className="flex-1 bg-zinc-900 p-3">
                <div className="grid gap-2">
                  <div className="h-7 rounded-lg bg-zinc-700" />
                  <div className="h-7 rounded-lg bg-zinc-800" />
                  <div className="h-7 rounded-lg bg-zinc-800" />
                </div>
              </div>
            </div>
          ) : null}

          {mode === 'system' ? (
            <div className="relative flex h-full bg-white">
              <div className="w-[28%] border-r border-slate-200 bg-slate-50 p-2">
                <div className="h-2.5 w-12 rounded-full bg-sky-500" />
                <div className="mt-3 space-y-2">
                  <div className="h-2 w-14 rounded-full bg-slate-300" />
                  <div className="h-2 w-12 rounded-full bg-slate-200" />
                  <div className="h-2 w-10 rounded-full bg-slate-200" />
                </div>
              </div>
              <div className="flex-1 bg-sky-50 p-3">
                <div className="grid gap-2">
                  <div className="h-7 rounded-lg bg-sky-100" />
                  <div className="h-7 rounded-lg bg-sky-100" />
                  <div className="h-7 rounded-lg bg-sky-100" />
                </div>
              </div>
              <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(140deg,transparent_49.5%,rgba(24,24,27,0.9)_50%,rgba(24,24,27,0.9)_100%)]" />
            </div>
          ) : null}
        </div>

        <div className="pointer-events-none absolute left-2 top-2 flex h-7 w-7 items-center justify-center rounded-full bg-background/90 text-foreground shadow-sm">
          <Icon className="h-4 w-4" />
        </div>
      </div>

      <div className="mt-3 flex items-center justify-between gap-3">
        <span className="text-base font-medium text-foreground">{title}</span>
        <span
          className={`h-5 w-5 rounded-full border ${
            selected ? 'border-primary bg-primary' : 'border-border bg-background'
          }`}
        />
      </div>
    </button>
  );
}

export default function AdminSettingsPage() {
  const { theme, setTheme } = useTheme();
  const {
    currentUser,
    currentTenant,
    currentTenantSettings,
    currentTenantPermissions,
    setCurrentTenant,
    setCurrentTenantSettings,
  } = useStore();
  const [settings, setSettings] = useState<TenantSettingsShape | null>(currentTenantSettings);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [auditData, setAuditData] = useState<AdminTenantAuditData | null>(null);
  const [auditLoading, setAuditLoading] = useState(false);
  const [auditError, setAuditError] = useState<string | null>(null);
  const [auditModuleFilter, setAuditModuleFilter] = useState('all');
  const [auditActionFilter, setAuditActionFilter] = useState('all');
  const [auditFrom, setAuditFrom] = useState('');
  const [auditTo, setAuditTo] = useState('');
  const [activePanel, setActivePanel] = useState<SettingsPanel>('pricing');
  const [terminals, setTerminals] = useState<AdminTerminalsData['terminals']>([]);
  const [themeMounted, setThemeMounted] = useState(false);
  const loadingRef = useRef(false);

  const canLoad = currentUser?.role === 'admin' && Boolean(currentTenant);
  const canManage = currentTenantPermissions.includes('tenant.settings.manage');
  const canView = currentTenantPermissions.includes('tenant.settings.view');
  const canViewAudit = currentTenantPermissions.includes('tenant.audit.view');

  const loadData = useCallback(async () => {
    if (!canLoad || loadingRef.current) return;
    loadingRef.current = true;
    try {
      const [response, terminalsResponse] = await Promise.all([
        getAdminTenantSettingsData(),
        getAdminTerminalsData(),
      ]);

      setSettings(response.settings);
      setTerminals(terminalsResponse.terminals);
      setCurrentTenantSettings(response.settings);

      if (currentTenant) {
        setCurrentTenant({
          ...currentTenant,
          ...response.tenant,
        });
      }

      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load tenant settings.');
    } finally {
      loadingRef.current = false;
      setLoading(false);
    }
  }, [canLoad, currentTenant, setCurrentTenant, setCurrentTenantSettings]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const loadAuditData = useCallback(async () => {
    if (!canLoad || !canViewAudit) return;

    setAuditLoading(true);
    try {
      const response = await getAdminTenantAuditLogs();
      setAuditData(response);
      setAuditError(null);
    } catch (err) {
      setAuditError(err instanceof Error ? err.message : 'Failed to load tenant audit log.');
    } finally {
      setAuditLoading(false);
    }
  }, [canLoad, canViewAudit]);

  useEffect(() => {
    void loadAuditData();
  }, [loadAuditData]);

  useEffect(() => {
    setThemeMounted(true);
  }, []);

  const sidebarItems = getAdminSidebarItems();

  const navItems = useMemo<SettingsNavItem[]>(() => {
    const baseItems: SettingsNavItem[] = [
      {
        value: 'appearance',
        label: 'Appearance',
        description: 'Choose light, dark, or device-based theme mode for this browser.',
        group: 'Workspace',
        icon: Laptop,
      },
      {
        value: 'pricing',
        label: 'On-Demand Fare',
        description: 'Set the default fare formula used for passenger quotes.',
        group: 'Operations',
        icon: CircleDollarSign,
      },
      {
        value: 'terminals',
        label: 'Terminal Adjustments',
        description: 'Apply flat fare adjustments for each TODA terminal.',
        group: 'Operations',
        icon: MapPinned,
      },
    ];

    if (canViewAudit) {
      baseItems.push({
        value: 'audit',
        label: 'Audit Log',
        description: 'Review recent tenant actions related to settings and operations.',
        group: 'Review',
        icon: ScrollText,
      });
    }

    return baseItems;
  }, [canViewAudit]);

  useEffect(() => {
    if (!navItems.some((item) => item.value === activePanel)) {
      setActivePanel('pricing');
    }
  }, [activePanel, navItems]);

  const filteredAuditLogs = useMemo(() => {
    const logs = auditData?.logs ?? [];

    return logs.filter((log) => {
      if (auditModuleFilter !== 'all' && log.module !== auditModuleFilter) {
        return false;
      }
      if (auditActionFilter !== 'all' && log.action !== auditActionFilter) {
        return false;
      }

      const createdAt = new Date(log.createdAt);
      if (auditFrom) {
        const fromDate = new Date(auditFrom);
        if (createdAt < fromDate) return false;
      }
      if (auditTo) {
        const toDate = new Date(`${auditTo}T23:59:59`);
        if (createdAt > toDate) return false;
      }

      return true;
    });
  }, [auditActionFilter, auditData?.logs, auditFrom, auditModuleFilter, auditTo]);

  const auditModules = useMemo(
    () => Array.from(new Set((auditData?.logs ?? []).map((log) => log.module))).sort(),
    [auditData?.logs]
  );
  const auditActions = useMemo(
    () => Array.from(new Set((auditData?.logs ?? []).map((log) => log.action))).sort(),
    [auditData?.logs]
  );
  const themeMode = useMemo<ThemeMode>(() => {
    if (theme === 'light' || theme === 'dark') {
      return theme;
    }

    return 'system';
  }, [theme]);

  if (!currentUser || currentUser.role !== 'admin' || !currentTenant) {
    return (
      <div className="space-y-6 p-6">
        <PageHeaderSkeleton />
        <SettingsPanelSkeleton showTabs={false} rowCount={2} />
      </div>
    );
  }

  const draft = settings ?? currentTenantSettings;

  const updateSettings = (updater: (prev: TenantSettingsShape) => TenantSettingsShape) => {
    setNotice(null);
    setSettings((prev) => (prev ? updater(prev) : prev));
  };

  const handleSave = async (successMessage = 'Tenant settings saved.') => {
    if (!draft || !canManage || saving) return;

    setSaving(true);
    setError(null);
    setNotice(null);

    try {
      const response = await updateAdminTenantSettings(draft);
      setSettings(response.settings);
      setCurrentTenantSettings(response.settings);

      if (currentTenant) {
        setCurrentTenant({
          ...currentTenant,
          ...response.tenant,
        });
      }

      setNotice(successMessage);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save tenant settings.');
    } finally {
      setSaving(false);
    }
  };

  const groupedNavItems = navItems.reduce<Record<string, SettingsNavItem[]>>((groups, item) => {
    const existing = groups[item.group] ?? [];
    return {
      ...groups,
      [item.group]: [...existing, item],
    };
  }, {});

  return (
    <>
      <AppHeader />
      <div className="mx-auto max-w-7xl px-4 pb-8">
        <SidebarLayout title="Admin Menu" items={sidebarItems}>
          <div className="space-y-6">
            {loading ? (
              <>
                <PageHeaderSkeleton withAction />
                <SettingsPanelSkeleton showTabs={false} rowCount={5} />
              </>
            ) : (
              <>
                <div className="space-y-1">
                  <h1 className="text-2xl font-semibold tracking-tight text-foreground">Settings</h1>
                  <p className="text-sm text-muted-foreground">
                    Keep this workspace focused on appearance, fare controls, and terminal adjustments.
                  </p>
                </div>

                {error ? (
                  <InlineErrorState
                    message={error}
                    onRetry={() => void loadData()}
                    retryLabel="Retry settings"
                  />
                ) : null}

                {notice ? <p className="text-sm text-muted-foreground">{notice}</p> : null}

                {!canView ? (
                  <div className="rounded-xl border px-4 py-6 text-sm text-muted-foreground">
                    Your tenant role does not include permission to view tenant settings.
                  </div>
                ) : draft ? (
                  <div className="grid gap-6 lg:grid-cols-[240px_minmax(0,1fr)]">
                    <aside className="space-y-4 pt-1">
                      <div className="space-y-4">
                        {Object.entries(groupedNavItems).map(([group, items]) => (
                          <div key={group} className="space-y-2">
                            <p className="px-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                              {group}
                            </p>
                            <div className="space-y-1">
                              {items.map((item) => (
                                <SettingsLinkButton
                                  key={item.value}
                                  item={item}
                                  active={activePanel === item.value}
                                  onClick={() => setActivePanel(item.value)}
                                />
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    </aside>

                    <section className={PANEL_CLASSNAME}>
                      {activePanel === 'appearance' ? (
                        <>
                          <div className="space-y-5 px-5 py-5">
                            <div className="space-y-1">
                              <h2 className="text-base font-semibold text-foreground">Appearance</h2>
                              <p className="text-sm text-muted-foreground">
                                Theme mode is saved in this browser and applies immediately across the admin workspace.
                              </p>
                            </div>
                            <div className="grid gap-4 md:grid-cols-3">
                              <ThemeModeCard
                                mode="light"
                                title="Light"
                                icon={Sun}
                                selected={themeMounted && themeMode === 'light'}
                                onSelect={(mode) => {
                                  setTheme(mode);
                                  setNotice('Appearance updated for this browser.');
                                }}
                              />
                              <ThemeModeCard
                                mode="dark"
                                title="Dark"
                                icon={Moon}
                                selected={themeMounted && themeMode === 'dark'}
                                onSelect={(mode) => {
                                  setTheme(mode);
                                  setNotice('Appearance updated for this browser.');
                                }}
                              />
                              <ThemeModeCard
                                mode="system"
                                title="Device settings"
                                icon={Laptop}
                                selected={themeMounted && themeMode === 'system'}
                                onSelect={(mode) => {
                                  setTheme(mode);
                                  setNotice('Appearance updated for this browser.');
                                }}
                              />
                            </div>

                            <p className="text-sm text-muted-foreground">
                              This appearance setting is local to your current browser and does not change the tenant&apos;s branding.
                            </p>
                          </div>
                        </>
                      ) : null}

                      {activePanel === 'pricing' ? (
                        <>
                          <div className="space-y-5 px-5 py-5">
                            <div className="space-y-1">
                              <h2 className="text-base font-semibold text-foreground">On-Demand Fare</h2>
                              <p className="text-sm text-muted-foreground">
                                Adjust the tenant-wide fare formula used before any terminal-specific adjustment is applied.
                              </p>
                            </div>
                            <div className="grid gap-4 md:grid-cols-3">
                              <div className="space-y-2">
                                <Label htmlFor="on-demand-base-fare">Base fare</Label>
                                <Input
                                  id="on-demand-base-fare"
                                  type="number"
                                  inputMode="decimal"
                                  min={20}
                                  max={200}
                                  step="0.01"
                                  value={draft.operationsPreferences.onDemandFare.baseFare}
                                  onChange={(event) =>
                                    updateSettings((prev) => ({
                                      ...prev,
                                      operationsPreferences: {
                                        ...prev.operationsPreferences,
                                        onDemandFare: {
                                          ...prev.operationsPreferences.onDemandFare,
                                          baseFare: parseMoneyInput(
                                            event.target.value,
                                            prev.operationsPreferences.onDemandFare.baseFare
                                          ),
                                        },
                                      },
                                    }))
                                  }
                                  disabled={!canManage}
                                />
                              </div>
                              <div className="space-y-2">
                                <Label htmlFor="on-demand-per-km">Per kilometer</Label>
                                <Input
                                  id="on-demand-per-km"
                                  type="number"
                                  inputMode="decimal"
                                  min={0}
                                  max={50}
                                  step="0.01"
                                  value={draft.operationsPreferences.onDemandFare.perKmFare}
                                  onChange={(event) =>
                                    updateSettings((prev) => ({
                                      ...prev,
                                      operationsPreferences: {
                                        ...prev.operationsPreferences,
                                        onDemandFare: {
                                          ...prev.operationsPreferences.onDemandFare,
                                          perKmFare: parseMoneyInput(
                                            event.target.value,
                                            prev.operationsPreferences.onDemandFare.perKmFare
                                          ),
                                        },
                                      },
                                    }))
                                  }
                                  disabled={!canManage}
                                />
                              </div>
                              <div className="space-y-2">
                                <Label htmlFor="on-demand-per-minute">Per minute</Label>
                                <Input
                                  id="on-demand-per-minute"
                                  type="number"
                                  inputMode="decimal"
                                  min={0}
                                  max={20}
                                  step="0.01"
                                  value={draft.operationsPreferences.onDemandFare.perMinuteFare}
                                  onChange={(event) =>
                                    updateSettings((prev) => ({
                                      ...prev,
                                      operationsPreferences: {
                                        ...prev.operationsPreferences,
                                        onDemandFare: {
                                          ...prev.operationsPreferences.onDemandFare,
                                          perMinuteFare: parseMoneyInput(
                                            event.target.value,
                                            prev.operationsPreferences.onDemandFare.perMinuteFare
                                          ),
                                        },
                                      },
                                    }))
                                  }
                                  disabled={!canManage}
                                />
                              </div>
                            </div>

                            <div className="rounded-2xl border border-border/70 bg-muted/35 p-4">
                              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                                Current Formula
                              </p>
                              <p className="mt-3 text-lg font-semibold text-foreground">
                                P{draft.operationsPreferences.onDemandFare.baseFare.toFixed(2)} + P
                                {draft.operationsPreferences.onDemandFare.perKmFare.toFixed(2)}/km + P
                                {draft.operationsPreferences.onDemandFare.perMinuteFare.toFixed(2)}/min
                              </p>
                              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                                Terminal adjustments are handled separately, so this stays as the shared baseline quote
                                for every pickup.
                              </p>
                            </div>

                            <div className="flex justify-end border-t border-border/70 pt-4">
                              <Button
                                onClick={() => void handleSave('On-demand fare settings saved.')}
                                disabled={!canManage || saving}
                              >
                                {saving ? 'Saving...' : 'Save Fare Settings'}
                              </Button>
                            </div>
                          </div>
                        </>
                      ) : null}

                      {activePanel === 'terminals' ? (
                        <>
                          <div className="px-5 py-5">
                            <div className="space-y-1 pb-5">
                              <h2 className="text-base font-semibold text-foreground">Terminal Fare Adjustments</h2>
                              <p className="text-sm text-muted-foreground">
                                Apply a flat amount to quotes when the pickup resolves to a specific TODA terminal.
                              </p>
                            </div>
                            {terminals.length === 0 ? (
                              <div className="rounded-2xl border border-dashed px-4 py-6 text-sm text-muted-foreground">
                                No terminals are available for adjustment yet.
                              </div>
                            ) : (
                              <div className="overflow-hidden rounded-2xl border border-border/70">
                                <Table>
                                  <TableHeader>
                                    <TableRow>
                                      <TableHead>Terminal</TableHead>
                                      <TableHead>Location</TableHead>
                                      <TableHead className="w-[180px]">Adjustment</TableHead>
                                    </TableRow>
                                  </TableHeader>
                                  <TableBody>
                                    {terminals.map((terminal) => (
                                      <TableRow key={terminal.id}>
                                        <TableCell>
                                          <div>
                                            <p className="font-medium text-foreground">{terminal.name}</p>
                                            <p className="text-xs text-muted-foreground">
                                              Capacity {terminal.capacity} | Queue {terminal.currentQueued}
                                            </p>
                                          </div>
                                        </TableCell>
                                        <TableCell className="text-sm text-muted-foreground">
                                          {terminal.location}
                                        </TableCell>
                                        <TableCell>
                                          <Input
                                            type="number"
                                            inputMode="decimal"
                                            min={-100}
                                            max={150}
                                            step="0.01"
                                            value={getTerminalAdjustmentAmount(draft, terminal.id)}
                                            onChange={(event) =>
                                              updateSettings((prev) => {
                                                const amount = parseMoneyInput(
                                                  event.target.value,
                                                  getTerminalAdjustmentAmount(prev, terminal.id)
                                                );

                                                return {
                                                  ...prev,
                                                  operationsPreferences: {
                                                    ...prev.operationsPreferences,
                                                    onDemandFare: {
                                                      ...prev.operationsPreferences.onDemandFare,
                                                      terminalAdjustments: updateTerminalAdjustmentList(
                                                        prev.operationsPreferences.onDemandFare.terminalAdjustments,
                                                        terminal.id,
                                                        amount
                                                      ),
                                                    },
                                                  },
                                                };
                                              })
                                            }
                                            disabled={!canManage}
                                          />
                                        </TableCell>
                                      </TableRow>
                                    ))}
                                  </TableBody>
                                </Table>
                              </div>
                            )}

                            <div className="mt-5 flex justify-end border-t border-border/70 pt-4">
                              <Button
                                onClick={() => void handleSave('Terminal fare adjustments saved.')}
                                disabled={!canManage || saving}
                              >
                                {saving ? 'Saving...' : 'Save Terminal Adjustments'}
                              </Button>
                            </div>
                          </div>
                        </>
                      ) : null}

                      {activePanel === 'audit' && canViewAudit ? (
                        <>
                          <div className="space-y-1 px-5 pt-5">
                            <h2 className="text-base font-semibold text-foreground">Audit Log</h2>
                            <p className="text-sm text-muted-foreground">
                              Review recent tenant actions tied to settings, drivers, reservations, trips, and terminals.
                            </p>
                          </div>
                          <div className="grid gap-3 border-b border-border/70 px-5 py-4 md:grid-cols-4">
                            <div className="space-y-2">
                              <Label>Module</Label>
                              <Select value={auditModuleFilter} onValueChange={setAuditModuleFilter}>
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
                              <Select value={auditActionFilter} onValueChange={setAuditActionFilter}>
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
                            <div className="space-y-2">
                              <Label htmlFor="audit-from">From</Label>
                              <Input
                                id="audit-from"
                                type="date"
                                value={auditFrom}
                                onChange={(event) => setAuditFrom(event.target.value)}
                              />
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor="audit-to">To</Label>
                              <Input
                                id="audit-to"
                                type="date"
                                value={auditTo}
                                onChange={(event) => setAuditTo(event.target.value)}
                              />
                            </div>
                          </div>

                          {auditError ? (
                            <div className="border-b border-border/70 px-5 py-3 text-sm text-destructive">
                              {auditError}
                            </div>
                          ) : null}

                          {auditLoading ? (
                            <div className="px-5 py-6 text-sm text-muted-foreground">Loading audit log...</div>
                          ) : filteredAuditLogs.length === 0 ? (
                            <div className="px-5 py-6 text-sm text-muted-foreground">
                              No audit entries match the current filters.
                            </div>
                          ) : (
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
                                {filteredAuditLogs.map((log) => (
                                  <TableRow key={log.id}>
                                    <TableCell>{new Date(log.createdAt).toLocaleString()}</TableCell>
                                    <TableCell>{log.module}</TableCell>
                                    <TableCell>{log.action}</TableCell>
                                    <TableCell>{log.actor?.name ?? 'System'}</TableCell>
                                    <TableCell className="max-w-[260px] whitespace-normal text-sm text-muted-foreground">
                                      {log.targetType}
                                      {log.targetId ? `: ${log.targetId}` : ''}
                                    </TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          )}
                        </>
                      ) : null}
                    </section>
                  </div>
                ) : null}
              </>
            )}
          </div>
        </SidebarLayout>
      </div>
    </>
  );
}
