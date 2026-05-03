'use client';

import type { ReactNode } from 'react';
import { useMemo } from 'react';
import { usePathname } from 'next/navigation';
import { useStore } from '@/lib/store-context';
import { getPassengerPrimaryNav } from '@/lib/passenger-navigation';
import { BottomNav } from '@/components/bottom-nav';
import { PassengerTopbar } from '@/components/passenger/passenger-topbar';
import { cn } from '@/lib/utils';
import { hasModuleHub } from '@/lib/transport-modules';
import { getTenantThemeVariables } from '@/lib/theme/tenant-theme';

interface PassengerAppShellProps {
  title: string;
  subtitle?: string;
  children: ReactNode;
  backHref?: string;
  topContext?: string;
  headerVariant?: 'default' | 'compact';
  contentClassName?: string;
  headerSurface?: 'panel' | 'minimal';
  preserveBottomNavSpace?: boolean;
  showHeader?: boolean;
  showBottomNav?: boolean;
}

function getInitials(value?: string | null) {
  if (!value?.trim()) {
    return 'P';
  }

  const parts = value
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2);

  return parts.map((part) => part[0]?.toUpperCase() ?? '').join('') || 'P';
}

export function PassengerAppShell({
  title,
  subtitle,
  children,
  backHref = '/passenger/home',
  topContext,
  headerVariant = 'default',
  contentClassName,
  headerSurface = 'panel',
  preserveBottomNavSpace = true,
  showHeader = true,
  showBottomNav = true,
}: PassengerAppShellProps) {
  const pathname = usePathname();
  const { currentTenantModules, currentUser, getTenantBranding } = useStore();

  const accountLabel = useMemo(() => getInitials(currentUser?.name), [currentUser?.name]);
  const isAccountArea = pathname.startsWith('/passenger/account');
  const isCompact = headerVariant === 'compact';

  const primaryNavItems = useMemo(
    () => getPassengerPrimaryNav({ hasModuleHub: hasModuleHub(currentTenantModules) }),
    [currentTenantModules],
  );

  const themeStyle = useMemo(
    () => getTenantThemeVariables(getTenantBranding(), 'tenant'),
    [getTenantBranding],
  );

  return (
    <div
      className="theme-passenger relative min-h-screen min-h-dvh overflow-x-hidden bg-background text-foreground"
      style={themeStyle}
    >
      <div className="pointer-events-none absolute inset-x-0 top-0 h-72 bg-[radial-gradient(circle_at_top,_color-mix(in_oklab,var(--primary)_20%,transparent),transparent_70%)] opacity-80" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle,_color-mix(in_oklab,var(--primary)_8%,transparent)_1px,transparent_1px)] [background-size:18px_18px] opacity-[0.07] dark:opacity-[0.12]" />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-background/30 via-background/6 to-transparent dark:from-background/25" />

      {showHeader ? (
        <PassengerTopbar
          title={title}
          subtitle={subtitle}
          backHref={backHref}
          topContext={topContext}
          compact={isCompact}
          accountLabel={accountLabel}
          isAccountArea={isAccountArea}
          surface={headerSurface}
        />
      ) : null}

      <main
        className={cn(
          'relative z-10 mx-auto w-full max-w-screen-sm space-y-4 px-4 py-3',
          contentClassName,
        )}
        style={{
          paddingBottom:
            preserveBottomNavSpace && showBottomNav
              ? 'calc(6.75rem + env(safe-area-inset-bottom))'
              : undefined,
        }}
      >
        {children}
      </main>

      {showBottomNav ? <BottomNav items={primaryNavItems} /> : null}
    </div>
  );
}