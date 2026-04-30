'use client';

import { ReactNode, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Layers3, Menu } from 'lucide-react';
import { AdminAppShell } from '@/components/admin/admin-app-shell';
import { Button } from '@/components/ui/button';
import { BottomNav } from '@/components/bottom-nav';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { getAdminDriversData } from '@/lib/dashboard/client';
import { filterAdminSidebarItemsBySettings, type AdminSidebarItem } from '@/lib/admin-navigation';
import { getDriverPrimaryNav, isPathInNavItem } from '@/lib/driver-navigation';
import { BRAND_NAME, DEFAULT_BRAND_LOGO_PATH, PLATFORM_NAME } from '@/lib/brand';
import { useStore } from '@/lib/store-context';
import { cn } from '@/lib/utils';
import { getAuthEntryRouteForCurrentUser } from '@/lib/role-routes';
import { hasModuleHub as tenantHasModuleHub } from '@/lib/transport-modules';

interface SidebarLayoutProps {
  children: ReactNode;
  items: AdminSidebarItem[];
  title: string;
  activeHref?: string;
}

export function SidebarLayout({ children, items, title, activeHref }: SidebarLayoutProps) {
  const pathname = usePathname();
  const {
    currentTenant,
    currentTenantModules,
    currentTenantSettings,
    currentUser,
    getTenantBranding,
    resetSessionState,
  } = useStore();
  const [isAdminSidebarCollapsed, setIsAdminSidebarCollapsed] = useState(false);
  const [pendingVerificationCount, setPendingVerificationCount] = useState<number | null>(null);
  const isDriverArea = pathname.startsWith('/driver');
  const isAdminDesktopArea = pathname.startsWith('/admin') || pathname.startsWith('/superadmin');
  const isSuperadminArea = pathname.startsWith('/superadmin');
  const branding = getTenantBranding();
  const resolvedActiveHref = activeHref ?? pathname;
  const showModuleHub = !isSuperadminArea && tenantHasModuleHub(currentTenantModules);
  const dashboardHref = isSuperadminArea ? '/superadmin/dashboard' : showModuleHub ? '/admin/modules' : '/admin/dashboard';

  useEffect(() => {
    setPendingVerificationCount(null);
  }, [currentTenant?.id]);

  useEffect(() => {
    if (!pathname.startsWith('/admin') || currentUser?.role !== 'admin' || !currentTenant || pendingVerificationCount != null) {
      return;
    }

    const hasPendingBadge = items.some((item) => item.href === '/admin/drivers' && item.badge != null);

    if (hasPendingBadge) {
      return;
    }

    void getAdminDriversData()
      .then((response) => {
        setPendingVerificationCount(response.stats.pendingVerification);
      })
      .catch(() => undefined);
  }, [currentTenant, currentUser?.role, items, pathname, pendingVerificationCount]);

  const resolvedItems = useMemo<AdminSidebarItem[]>(
    () =>
      items.map((item) =>
        item.href === '/admin/drivers' && item.badge == null && pendingVerificationCount != null
          ? { ...item, badge: pendingVerificationCount > 0 ? pendingVerificationCount : undefined }
          : item
      ),
    [items, pendingVerificationCount]
  );

  const navigationItems = useMemo<AdminSidebarItem[]>(
    () =>
      showModuleHub
        ? [
            {
              href: '/admin/modules',
              label: 'Modules',
              icon: <Layers3 className="h-4 w-4" />,
            },
            ...resolvedItems,
          ]
        : resolvedItems,
    [resolvedItems, showModuleHub]
  );

  const adminNavigationItems = filterAdminSidebarItemsBySettings(navigationItems, currentTenantSettings);

  const findActiveItem = (navigationItems: AdminSidebarItem[]): AdminSidebarItem | undefined => {
    for (const item of navigationItems) {
      if (item.href === resolvedActiveHref) {
        return item;
      }

      if (item.items) {
        const activeChild = findActiveItem(item.items);
        if (activeChild) {
          return activeChild;
        }
      }
    }

    return undefined;
  };

  const activeItem = findActiveItem(adminNavigationItems);

  const isItemActive = (item: AdminSidebarItem): boolean =>
    item.href === resolvedActiveHref || Boolean(item.items?.some((child) => isItemActive(child)));

  const handleLogout = async () => {
    await fetch('/api/auth/logout', {
      method: 'POST',
    });
    const redirectTarget =
      currentUser?.role ? getAuthEntryRouteForCurrentUser(currentUser.role) : isAdminDesktopArea ? '/admin-login' : '/';
    resetSessionState();
    window.location.href = redirectTarget;
  };

  const renderNavigation = (onItemClick?: () => void) => (
    <nav className="space-y-1.5">
      {filterAdminSidebarItemsBySettings(navigationItems, currentTenantSettings).map((item) => {
        const isActive = isItemActive(item);
        return (
          <div key={item.href ?? item.label} className="space-y-1.5">
            {item.href ? (
              <Link
                href={item.href}
                onClick={onItemClick}
                className={cn(
                  'group flex items-center gap-3 rounded-xl border px-3 py-2.5 text-sm transition-colors',
                  isActive
                    ? 'border-primary/25 bg-primary/10 font-semibold text-primary'
                    : 'border-transparent text-foreground hover:border-border hover:bg-muted'
                )}
              >
                <span className={cn('text-muted-foreground transition-colors', isActive && 'text-primary')}>
                  {item.icon}
                </span>
                <span>{item.label}</span>
                {item.badge != null ? (
                  <span
                    className={cn(
                      'ml-auto inline-flex min-w-5 items-center justify-center rounded-md px-1.5 py-0.5 text-[11px] font-semibold tabular-nums',
                      isActive ? 'bg-primary/15 text-primary' : 'bg-muted text-muted-foreground'
                    )}
                  >
                    {item.badge}
                  </span>
                ) : null}
              </Link>
            ) : (
              <div className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-foreground">
                <span className="text-muted-foreground">{item.icon}</span>
                <span>{item.label}</span>
                {item.badge != null ? (
                  <span
                    className={cn(
                      'ml-auto inline-flex min-w-5 items-center justify-center rounded-md px-1.5 py-0.5 text-[11px] font-semibold tabular-nums',
                      isActive ? 'bg-primary/15 text-primary' : 'bg-muted text-muted-foreground'
                    )}
                  >
                    {item.badge}
                  </span>
                ) : null}
              </div>
            )}

            {item.items?.length ? (
              <div className="ml-4 space-y-1 border-l border-border pl-3">
                {item.items.map((child) => {
                  const isChildActive = isItemActive(child);

                  return child.href ? (
                    <Link
                      key={child.href}
                      href={child.href}
                      onClick={onItemClick}
                      className={cn(
                        'group flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors',
                        isChildActive
                          ? 'bg-primary/10 font-semibold text-primary'
                          : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                      )}
                    >
                      <span className={cn('transition-colors', isChildActive && 'text-primary')}>{child.icon}</span>
                      <span>{child.label}</span>
                      {child.badge != null ? (
                        <span
                          className={cn(
                            'ml-auto inline-flex min-w-5 items-center justify-center rounded-md px-1.5 py-0.5 text-[11px] font-semibold tabular-nums',
                            isChildActive ? 'bg-primary/15 text-primary' : 'bg-muted text-muted-foreground'
                          )}
                        >
                          {child.badge}
                        </span>
                      ) : null}
                    </Link>
                  ) : null;
                })}
              </div>
            ) : null}
          </div>
        );
      })}
    </nav>
  );

  if (isDriverArea) {
    const pwaItems = getDriverPrimaryNav({ hasModuleHub: showModuleHub });

    return (
      <div className="mx-auto w-full max-w-screen-sm">
        <div className="mb-4 hidden md:grid grid-cols-4 gap-1.5 rounded-[2rem] border border-border/60 bg-background/88 p-2 shadow-[0_20px_45px_-18px_rgba(0,0,0,0.45)] backdrop-blur-2xl supports-[backdrop-filter]:bg-background/74">
          {pwaItems.map((item) => {
              const isActive = isPathInNavItem(pathname, item);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    'flex min-h-[4.1rem] flex-col items-center justify-center gap-1 rounded-[1.35rem] px-2 py-2 text-[11px] font-medium transition-all duration-200',
                    isActive
                      ? 'bg-primary/12 text-primary shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]'
                      : 'text-muted-foreground hover:bg-muted/35 hover:text-foreground'
                  )}
                >
                  {item.icon}
                  {item.label}
                </Link>
              );
            })}
        </div>

        <main
          className="min-w-0 pb-[calc(6rem+env(safe-area-inset-bottom))]"
        >
          {children}
        </main>
        <BottomNav items={pwaItems} />
      </div>
    );
  }

  if (isAdminDesktopArea) {
    const activeLabel = activeItem?.label ?? title;
    const scopeLabel = isSuperadminArea
      ? 'Platform-wide control'
      : currentTenant?.name
        ? `${currentTenant.name} tenant workspace`
        : 'Tenant workspace';
    const displayName = isSuperadminArea ? PLATFORM_NAME : branding.displayName ?? BRAND_NAME;

    return (
      <AdminAppShell
        items={adminNavigationItems}
        activeHref={resolvedActiveHref}
        collapsed={isAdminSidebarCollapsed}
        onToggleCollapsed={() => setIsAdminSidebarCollapsed((prev) => !prev)}
        dashboardHref={dashboardHref}
        returnHref={dashboardHref}
        workspaceTitle={title}
        scopeLabel={scopeLabel}
        activeLabel={activeLabel}
        displayName={displayName}
        logo={isSuperadminArea ? DEFAULT_BRAND_LOGO_PATH : branding.logo}
        onLogout={handleLogout}
      >
        {children}
      </AdminAppShell>
    );
  }

  return (
    <div className="flex gap-6">
      <aside className="hidden lg:block lg:w-72 lg:shrink-0">
        <div className="sticky top-20 h-[calc(100vh-90px)] overflow-y-auto rounded-2xl border border-border bg-card p-4 shadow-sm">
          <h2 className="mb-4 text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">{title}</h2>
          {renderNavigation()}
        </div>
      </aside>

      <main className="min-w-0 flex-1">
        <div className="mb-4 lg:hidden">
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="outline" className="gap-2 border-border bg-card text-foreground hover:bg-muted">
                <Menu className="h-4 w-4" />
                Open Menu
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-72.5 border-r border-border bg-card px-4">
              <SheetHeader className="px-0">
                <SheetTitle className="text-left text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                  {title}
                </SheetTitle>
              </SheetHeader>
              <div className="mt-2">{renderNavigation()}</div>
            </SheetContent>
          </Sheet>
        </div>
        {children}
      </main>
    </div>
  );
}
