'use client';

import { usePathname } from 'next/navigation';
import { BottomNav } from '@/components/bottom-nav';
import { DriverTopbar } from '@/components/driver/driver-topbar';
import { DriverAssignmentNotifier } from '@/components/driver/driver-assignment-notifier';
import { useDriverPresence } from '@/hooks/use-driver-presence';
import { useDriverDutyIntent } from '@/hooks/use-driver-duty-intent';
import {
  getDriverPrimaryNav,
  getDriverHeaderMeta,
} from '@/lib/driver-navigation';
import { useStore } from '@/lib/store-context';
import { cn } from '@/lib/utils';
import { hasModuleHub } from '@/lib/transport-modules';

interface DriverAppShellProps {
  children: React.ReactNode;
  backHref?: string;
  title?: string;
  subtitle?: string;
  topContext?: string;
  contentClassName?: string;
  headerVariant?: 'default' | 'compact';
  headerSurface?: 'panel' | 'minimal';
  preserveBottomNavSpace?: boolean;
  showHeader?: boolean;
}

export function DriverAppShell({
  children,
  backHref = '/driver/dashboard',
  topContext,
  contentClassName,
  headerVariant = 'compact',
  headerSurface = 'minimal',
  preserveBottomNavSpace = true,
  showHeader = true,
}: DriverAppShellProps) {
  const pathname = usePathname();
  const { currentTenantModules, currentUser } = useStore();
  const { isDutyOn } = useDriverDutyIntent(
    currentUser?.role === 'driver' ? currentUser.id : null,
  );
  const headerMeta = getDriverHeaderMeta(pathname);
  const isCompact = headerVariant === 'compact';
  const primaryNavItems = getDriverPrimaryNav({
    hasModuleHub: hasModuleHub(currentTenantModules),
  });

  useDriverPresence({
    enabled: Boolean(currentUser?.role === 'driver' && isDutyOn),
  });

  return (
    <div className="theme-driver relative min-h-screen min-h-dvh overflow-x-hidden bg-background text-foreground">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-72 bg-[radial-gradient(circle_at_top,_color-mix(in_oklab,var(--primary)_22%,transparent),transparent_70%)] opacity-90" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle,_color-mix(in_oklab,var(--primary)_10%,transparent)_1px,transparent_1px)] [background-size:18px_18px] opacity-[0.08] dark:opacity-[0.14]" />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-background/30 via-background/6 to-transparent dark:from-background/25" />

      {showHeader ? (
        <DriverTopbar
          backHref={backHref}
          topContext={topContext ?? headerMeta.topContext}
          compact={isCompact}
          surface={headerSurface}
        />
      ) : null}

      <main
        className={cn(
          'mx-auto w-full max-w-screen-sm space-y-5 px-4 py-3',
          contentClassName,
        )}
        style={{
          paddingBottom: preserveBottomNavSpace
            ? 'calc(6rem + env(safe-area-inset-bottom))'
            : undefined,
        }}
      >
        {children}
      </main>

      <BottomNav items={primaryNavItems} />
      <DriverAssignmentNotifier
        enabled={currentUser?.role === 'driver'}
        driverId={currentUser?.role === 'driver' ? currentUser.id : null}
      />
    </div>
  );
}
