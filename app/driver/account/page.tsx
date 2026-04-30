'use client';

import { useState } from 'react';
import {
  CarFront,
  CircleHelp,
  LogOut,
  MapPinned,
  Settings2,
  ShieldCheck,
  UserRound,
} from 'lucide-react';
import { DriverAppShell } from '@/components/driver/driver-app-shell';
import { InlineErrorState, PageLoadingState } from '@/components/page-state';
import {
  AccountRow,
  AccountSection,
  AccountValueRow,
} from '@/components/passenger/account-section';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { useDriverAccountData } from '@/hooks/use-driver-account-data';
import {
  getDriverAccessBadgeClassName,
  getDriverAccessLabel,
  getDriverAccountInitials,
  getDriverOperationalStateLabel,
} from '@/lib/driver-account-presenters';
import { getAuthEntryRouteForCurrentUser } from '@/lib/role-routes';
import { useStore } from '@/lib/store-context';
import { cn } from '@/lib/utils';

const accountLinks = [
  {
    href: '/driver/account/profile',
    label: 'Profile',
    description:
      'Review your stored driver details. Only supported contact fields can be edited here.',
    icon: UserRound,
  },
  {
    href: '/driver/account/vehicle',
    label: 'Vehicle Info',
    description:
      'See the license and vehicle records currently attached to your driver account.',
    icon: CarFront,
  },
  {
    href: '/driver/account/assignment',
    label: 'TODA / Assignment Info',
    description:
      'Review your assigned terminal context, duty state, and dispatch visibility.',
    icon: MapPinned,
  },
  {
    href: '/driver/account/status',
    label: 'Account Status',
    description:
      'View verification, restriction, and driver-document review summary.',
    icon: ShieldCheck,
  },
  {
    href: '/driver/account/settings',
    label: 'Settings',
    description: 'Keep driver settings simple. Only real app preferences appear here.',
    icon: Settings2,
  },
  {
    href: '/driver/account/help',
    label: 'Help & Support',
    description:
      'See support boundaries and quick answers for the current driver app.',
    icon: CircleHelp,
  },
];

export default function DriverAccountPage() {
  const {
    resetSessionState,
    currentUser,
  } = useStore();
  const { data, loading, error, reload } = useDriverAccountData();
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const handleLogout = async () => {
    setIsLoggingOut(true);

    try {
      await fetch('/api/auth/logout', {
        method: 'POST',
      });
    } finally {
      const redirectTarget = getAuthEntryRouteForCurrentUser(currentUser?.role);
      resetSessionState();
      window.location.href = redirectTarget;
    }
  };

  if (loading) {
    return (
      <PageLoadingState
        label="Loading driver account..."
        className="theme-driver min-h-screen bg-background text-foreground"
      />
    );
  }

  return (
    <DriverAppShell
      title="Account"
      subtitle="Profile, driver status, support, and the real settings available today."
      backHref="/driver/tricycle"
      topContext="Account"
      headerVariant="compact"
      headerSurface="minimal"
    >
      {error ? <InlineErrorState message={error} onRetry={() => void reload()} /> : null}

      {data ? (
        <>
          <section className="rounded-[2rem] border border-primary/15 bg-primary/[0.07] px-4 py-5">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <Avatar className="h-12 w-12 bg-primary/10">
                  <AvatarFallback className="bg-primary/10 font-semibold text-primary">
                    {getDriverAccountInitials(data.user.name)}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <p className="truncate text-lg font-semibold">
                    {data.profile.legalFullName ?? data.user.name}
                  </p>
                  <p className="truncate text-sm text-muted-foreground">
                    {data.profile.contactPhone ?? data.user.phone ?? 'Signed in with mobile OTP'}
                  </p>
                </div>
              </div>

              <span
                className={cn(
                  'inline-flex rounded-full border px-3 py-1 text-xs font-medium',
                  getDriverAccessBadgeClassName(data.accessState),
                )}
              >
                {getDriverAccessLabel(data.accessState)}
              </span>
            </div>

            <div className="mt-4 grid gap-2 sm:grid-cols-3">
              <div className="rounded-[1.35rem] bg-background/62 px-3.5 py-3">
                <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                  Contact email
                </p>
                <p className="mt-1 text-sm">
                  {data.profile.contactEmail ?? data.user.email ?? 'Add in Profile'}
                </p>
              </div>
              <div className="rounded-[1.35rem] bg-background/62 px-3.5 py-3">
                <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                  Assigned TODA
                </p>
                <p className="mt-1 text-sm">
                  {data.profile.toda
                    ? data.profile.toda.name
                    : 'No TODA / terminal assigned'}
                </p>
              </div>
              <div className="rounded-[1.35rem] bg-background/62 px-3.5 py-3">
                <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                  Operational state
                </p>
                <p className="mt-1 text-sm">
                  {data.presence.isOnline
                    ? 'On duty'
                    : getDriverOperationalStateLabel(data.profile.operationalState)}
                </p>
              </div>
            </div>
          </section>

          <AccountSection
            title="Driver account"
            description="Use account for self-service, status visibility, and driver-specific support details."
          >
            {accountLinks.map((item, index) => {
              const Icon = item.icon;

              return (
                <div key={item.href} className={index > 0 ? 'border-t border-border/60' : undefined}>
                  <AccountRow
                    href={item.href}
                    label={item.label}
                    description={item.description}
                    leading={
                      <div className="rounded-full border border-primary/20 bg-primary/10 p-2 text-primary">
                        <Icon className="h-4 w-4" />
                      </div>
                    }
                  />
                </div>
              );
            })}
          </AccountSection>

          <AccountSection
            title="Session"
            description="Signing out only ends this driver session on this device."
          >
            <AccountValueRow
              label="Sign out"
              value="Driver history, status, and assignment records stay attached to this account."
            />
            <div className="border-t border-border/60 px-4 py-4">
              <Button
                variant="outline"
                className="h-11 w-full justify-center gap-2 rounded-full"
                onClick={() => void handleLogout()}
                disabled={isLoggingOut}
              >
                <LogOut className="h-4 w-4" />
                {isLoggingOut ? 'Signing out...' : 'Sign out'}
              </Button>
            </div>
          </AccountSection>
        </>
      ) : null}
    </DriverAppShell>
  );
}
