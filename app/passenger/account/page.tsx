'use client';

import { useState } from 'react';
import { LifeBuoy, LogOut, MoonStar, ShieldPlus, UserRound } from 'lucide-react';
import { useStore } from '@/lib/store-context';
import { PassengerAppShell } from '@/components/passenger/passenger-app-shell';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { getAuthEntryRouteForCurrentUser } from '@/lib/role-routes';
import {
  AccountRow,
  AccountSection,
  AccountValueRow,
} from '@/components/passenger/account-section';

function getInitials(value?: string | null) {
  if (!value?.trim()) {
    return 'P';
  }

  return (
    value
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? '')
      .join('') || 'P'
  );
}

const accountLinks = [
  {
    href: '/passenger/account/profile',
    label: 'Profile',
    description: 'Update your real passenger identity details.',
    icon: UserRound,
  },
  {
    href: '/passenger/account/emergency',
    label: 'Emergency Contact',
    description: 'Keep your emergency contact current and reachable.',
    icon: ShieldPlus,
  },
  {
    href: '/passenger/account/settings',
    label: 'Settings',
    description: 'Manage real app preferences like theme mode.',
    icon: MoonStar,
  },
  {
    href: '/passenger/account/help',
    label: 'Help & Support',
    description: 'See quick help answers and app support notes.',
    icon: LifeBuoy,
  },
];

export default function PassengerAccountPage() {
  const {
    currentUser,
    resetSessionState,
  } = useStore();
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

  const emergencySummary = currentUser?.emergencyContactName
    ? `${currentUser.emergencyContactName}${currentUser.emergencyContactPhone ? ` | ${currentUser.emergencyContactPhone}` : ''}`
    : 'Add an emergency contact';

  return (
    <PassengerAppShell
      title="Account"
      subtitle="Profile, support, and app preferences."
      backHref="/passenger/tricycle"
      topContext="Account"
      headerVariant="compact"
      headerSurface="minimal"
    >
      <section className="rounded-[2rem] border border-primary/15 bg-primary/[0.07] px-4 py-5">
        <div className="flex items-center gap-3">
          <Avatar className="h-12 w-12 bg-primary/10">
            <AvatarFallback className="bg-primary/10 font-semibold text-primary">
              {getInitials(currentUser?.name)}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <p className="truncate text-lg font-semibold">{currentUser?.name ?? 'Account'}</p>
            <p className="truncate text-sm text-muted-foreground">
              {currentUser?.phone ?? 'Signed in with mobile OTP'}
            </p>
          </div>
        </div>

        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          <div className="rounded-[1.35rem] bg-background/62 px-3.5 py-3">
            <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Email</p>
            <p className="mt-1 text-sm">{currentUser?.email ?? 'Add your email in Profile'}</p>
          </div>
          <div className="rounded-[1.35rem] bg-background/62 px-3.5 py-3">
            <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
              Emergency contact
            </p>
            <p className="mt-1 text-sm">{emergencySummary}</p>
          </div>
        </div>
      </section>

      <AccountSection
        title="Account"
        description="Manage the real passenger details and support options available in the app today."
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

      <AccountSection title="Session" description="Signing out only ends this session on this device.">
        <AccountValueRow
          label="Account status"
          value="Your ride and reservation history stay attached to this passenger account."
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
    </PassengerAppShell>
  );
}
