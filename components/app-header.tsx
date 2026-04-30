'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LogOut, Route } from 'lucide-react';
import { BRAND_NAME } from '@/lib/brand';
import { useStore } from '@/lib/store-context';
import { Button } from '@/components/ui/button';
import { ReturnNavigation } from '@/components/return-navigation';
import { TenantSwitcher } from './tenant-switcher';
import { RoleSwitcher } from './role-switcher';
import { getAuthEntryRouteForCurrentUser } from '@/lib/role-routes';
import { MobileUserTopbar } from '@/components/mobile-user-topbar';
import { getDriverHeaderMeta } from '@/lib/driver-navigation';

interface AppHeaderProps {
  showDevTools?: boolean;
}

export function AppHeader({ showDevTools = false }: AppHeaderProps) {
  const pathname = usePathname();
  const { currentUser, getTenantBranding, resetSessionState } = useStore();
  const branding = getTenantBranding();
  const isAdminWorkspaceRoute = pathname.startsWith('/admin') || pathname.startsWith('/superadmin');
  const isDriverWorkspaceRoute = pathname.startsWith('/driver');
  const showTenantBrand =
    (currentUser?.role === 'admin' || currentUser?.role === 'driver') && Boolean(branding.logo);

  const handleLogout = async () => {
    await fetch('/api/auth/logout', {
      method: 'POST',
    });
    const redirectTarget = getAuthEntryRouteForCurrentUser(currentUser?.role);
    resetSessionState();
    window.location.href = redirectTarget;
  };

  if (isAdminWorkspaceRoute) {
    return null;
  }

  if (currentUser?.role === 'driver' && isDriverWorkspaceRoute) {
    const headerMeta = getDriverHeaderMeta(pathname);

    return (
      <MobileUserTopbar
        title={headerMeta.title}
        subtitle={headerMeta.subtitle}
        topContext={headerMeta.topContext}
        compact
        surface="minimal"
        contextIcon={<Route className="h-3.5 w-3.5" />}
        trailing={
          <button
            type="button"
            onClick={handleLogout}
            className="inline-flex h-12 w-12 items-center justify-center rounded-full border border-border/65 bg-background/76 text-foreground shadow-[0_10px_26px_-18px_rgba(0,0,0,0.5)] backdrop-blur-xl transition hover:border-primary/35 hover:bg-primary/5"
            aria-label="Sign out"
          >
            <LogOut className="h-4 w-4" />
          </button>
        }
      />
    );
  }

  return (
      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="flex h-16 items-center justify-between px-4 sm:px-6">
        <div className="flex items-center gap-2">
          <ReturnNavigation
            fallbackHref="/"
            className="h-10 w-10 rounded-full border border-border/60 bg-background/76 text-foreground backdrop-blur-xl hover:bg-muted"
          />

          <Link href="/" className="flex items-center gap-2 font-bold text-lg">
            {showTenantBrand ? (
              <img
                src={branding.logo}
                alt="Tenant logo"
                className="h-8 w-8 rounded-lg object-cover"
              />
            ) : (
              <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center text-primary-foreground font-bold">
                T
              </div>
            )}
            <span className="hidden sm:inline">{branding.displayName ?? BRAND_NAME}</span>
          </Link>
        </div>

        <div className="flex items-center gap-2">
          {showDevTools && (
            <>
              <TenantSwitcher />
              <RoleSwitcher />
            </>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={handleLogout}
            className="gap-2"
          >
            <LogOut className="h-4 w-4" />
            <span className="hidden sm:inline">Sign out</span>
          </Button>
        </div>
      </div>
    </header>
  );
}
