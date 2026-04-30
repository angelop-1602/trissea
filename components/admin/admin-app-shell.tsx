'use client';

import type { ReactNode } from 'react';
import { MonitorSmartphone } from 'lucide-react';
import type { AdminSidebarItem } from '@/lib/admin-navigation';
import { AdminSidebar } from '@/components/admin/admin-sidebar';
import { AdminTopbar } from '@/components/admin/admin-topbar';

interface AdminAppShellProps {
  children: ReactNode;
  items: AdminSidebarItem[];
  activeHref: string;
  collapsed: boolean;
  onToggleCollapsed: () => void;
  dashboardHref: string;
  returnHref: string;
  workspaceTitle: string;
  scopeLabel: string;
  activeLabel: string;
  displayName: string;
  logo?: string;
  onLogout: () => void | Promise<void>;
}

export function AdminAppShell({
  children,
  items,
  activeHref,
  collapsed,
  onToggleCollapsed,
  dashboardHref,
  returnHref,
  workspaceTitle,
  scopeLabel,
  activeLabel,
  displayName,
  logo,
  onLogout,
}: AdminAppShellProps) {
  return (
    <div className="bg-background lg:fixed lg:inset-0">
      <div className="p-4 lg:hidden">
        <div className="rounded-3xl border border-border bg-card p-6 text-center shadow-sm">
          <MonitorSmartphone className="mx-auto mb-3 h-7 w-7 text-muted-foreground" />
          <h3 className="text-base font-semibold text-foreground">Desktop Layout Only</h3>
          <p className="mt-2 text-sm text-muted-foreground">
            Admin and Super Admin pages are desktop-only. Open this page on a larger screen.
          </p>
        </div>
      </div>

      <div className="hidden h-full overflow-hidden bg-[linear-gradient(180deg,color-mix(in_oklab,var(--primary),transparent_96%)_0%,color-mix(in_oklab,var(--background),white_2%)_34%,var(--background)_100%)] lg:flex">
        <AdminSidebar
          items={items}
          activeHref={activeHref}
          collapsed={collapsed}
          dashboardHref={dashboardHref}
          workspaceTitle={workspaceTitle}
          scopeLabel={scopeLabel}
          displayName={displayName}
          logo={logo}
          onLogout={onLogout}
        />

        <div className="flex min-w-0 flex-1 min-h-0 flex-col overflow-hidden">
          <AdminTopbar
            activeLabel={activeLabel}
            areaLabel={workspaceTitle}
            scopeLabel={scopeLabel}
            collapsed={collapsed}
            onToggleCollapsed={onToggleCollapsed}
            returnHref={returnHref}
          />

          <main className="min-w-0 flex-1 overflow-y-auto">
            <div className="mx-auto min-h-full w-full max-w-[1600px] px-6 py-6">
              {children}
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}
