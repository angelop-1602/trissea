'use client';

import { useMemo } from 'react';
import { usePathname } from 'next/navigation';
import { useStore } from '@/lib/store-context';
import { getPassengerPrimaryNav } from '@/lib/passenger-navigation';
import { BottomNav } from '@/components/bottom-nav';
import { PassengerTopbar } from '@/components/passenger/passenger-topbar';
import { cn } from '@/lib/utils';
import { hasModuleHub } from '@/lib/transport-modules';

interface PassengerAppShellProps {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  backHref?: string;
  topContext?: string;
  headerVariant?: 'default' | 'compact';
  contentClassName?: string;
  headerSurface?: 'panel' | 'minimal';
  preserveBottomNavSpace?: boolean;
  showHeader?: boolean;
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
}: PassengerAppShellProps) {
  const pathname = usePathname();
  const { currentTenantModules, currentUser } = useStore();

  const accountLabel = useMemo(() => getInitials(currentUser?.name), [currentUser?.name]);
  const isAccountArea = pathname.startsWith('/passenger/account');
  const isCompact = headerVariant === 'compact';
  const primaryNavItems = useMemo(
    () => getPassengerPrimaryNav({ hasModuleHub: hasModuleHub(currentTenantModules) }),
    [currentTenantModules]
  );

  return (
    <div className="theme-passenger relative min-h-screen min-h-dvh overflow-x-hidden bg-background text-foreground">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-72 bg-[radial-gradient(circle_at_top,_color-mix(in_oklab,var(--primary)_24%,transparent),transparent_70%)] opacity-90" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle,_color-mix(in_oklab,var(--primary)_10%,transparent)_1px,transparent_1px)] [background-size:18px_18px] opacity-[0.08] dark:opacity-[0.14]" />
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
        className={cn('mx-auto w-full max-w-screen-sm space-y-5 px-4 py-3', contentClassName)}
        style={{
          paddingBottom: preserveBottomNavSpace
            ? 'calc(6rem + env(safe-area-inset-bottom))'
            : undefined,
        }}
      >
        {children}
      </main>
      <BottomNav items={primaryNavItems} />
    </div>
  );
}
