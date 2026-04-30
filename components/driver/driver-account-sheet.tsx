'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import {
  Activity,
  ClipboardList,
  Clock3,
  Laptop,
  LogOut,
  Moon,
  Sun,
} from 'lucide-react';
import { useTheme } from 'next-themes';
import { useStore } from '@/lib/store-context';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { getAuthEntryRouteForCurrentUser } from '@/lib/role-routes';

type ThemeMode = 'system' | 'light' | 'dark';

function getInitials(value?: string | null) {
  if (!value?.trim()) {
    return 'D';
  }

  const parts = value.trim().split(/\s+/).filter(Boolean).slice(0, 2);

  return parts.map((part) => part[0]?.toUpperCase() ?? '').join('') || 'D';
}

function getDriverAccessLabel(input: {
  isDriverVerified?: boolean | null;
  isDriverRestricted?: boolean | null;
}) {
  if (input.isDriverRestricted) {
    return 'Restricted';
  }

  if (input.isDriverVerified) {
    return 'Verified';
  }

  return 'Pending review';
}

export function DriverAccountSheet() {
  const { theme, setTheme } = useTheme();
  const {
    currentTenant,
    currentUser,
    resetSessionState,
  } = useStore();
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const accountLabel = useMemo(
    () => getInitials(currentUser?.name),
    [currentUser?.name],
  );
  const mode = useMemo<ThemeMode>(() => {
    if (theme === 'light' || theme === 'dark') {
      return theme;
    }

    return 'system';
  }, [theme]);

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

  return (
    <Sheet>
      <SheetTrigger asChild>
        <button
          type="button"
          className="bg-background/76 p-1.5 shadow-[0_10px_26px_-18px_rgba(0,0,0,0.5)] backdrop-blur-xl transition hover:border-primary/35 hover:bg-primary/5"
          aria-label="Open driver account"
        >
          <Avatar className="h-9 w-9 bg-primary/10">
            <AvatarFallback className="bg-primary/10 font-semibold text-primary">
              {accountLabel}
            </AvatarFallback>
          </Avatar>
        </button>
      </SheetTrigger>

      <SheetContent
        side="right"
        className="w-full max-w-sm border-l border-border/60 bg-background/96 px-0"
      >
        <SheetHeader className="px-5 pt-6">
          <div className="flex items-center gap-3">
            <Avatar className="h-12 w-12 bg-primary/10">
              <AvatarFallback className="bg-primary/10 font-semibold text-primary">
                {accountLabel}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <SheetTitle className="truncate text-left">
                {currentUser?.name ?? 'Driver'}
              </SheetTitle>
              <SheetDescription className="truncate">
                {currentUser?.phone ?? 'Signed in with mobile OTP'}
              </SheetDescription>
            </div>
          </div>
        </SheetHeader>

        <div className="space-y-5 px-5 pb-5">
          <section className="rounded-[1.75rem] border border-primary/15 bg-primary/[0.06] px-4 py-4">
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-1">
                <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                  Account
                </p>
                <p className="text-sm font-medium">
                  {currentTenant?.name ?? 'Driver workspace'}
                </p>
              </div>
              <span className="inline-flex rounded-full bg-background/70 px-3 py-1 text-[11px] font-medium text-foreground">
                {getDriverAccessLabel(currentUser ?? {})}
              </span>
            </div>

            <div className="mt-3 grid gap-2">
              <div className="rounded-[1.2rem] bg-background/70 px-3.5 py-3">
                <p className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                  Role
                </p>
                <p className="mt-1 text-sm">Operational driver access</p>
              </div>
              <div className="rounded-[1.2rem] bg-background/70 px-3.5 py-3">
                <p className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                  Workspace
                </p>
                <p className="mt-1 text-sm">
                  {currentTenant?.name ??
                    'Tenant context will appear here after sign in.'}
                </p>
              </div>
            </div>
          </section>

          <section className="space-y-3 rounded-[1.75rem] bg-background/60 px-4 py-4">
            <div className="space-y-1">
              <p className="text-sm font-medium">Appearance</p>
              <p className="text-xs text-muted-foreground">
                Theme mode applies across the driver workspace on this device.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="driver-theme-mode">Theme mode</Label>
              <Select value={mode} onValueChange={(value) => setTheme(value)}>
                <SelectTrigger
                  id="driver-theme-mode"
                  className="h-11 w-full rounded-[1.2rem]"
                >
                  <SelectValue placeholder="Select theme mode" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="system">
                    <span className="inline-flex items-center gap-2">
                      <Laptop className="h-4 w-4" />
                      Device settings
                    </span>
                  </SelectItem>
                  <SelectItem value="light">
                    <span className="inline-flex items-center gap-2">
                      <Sun className="h-4 w-4" />
                      Light
                    </span>
                  </SelectItem>
                  <SelectItem value="dark">
                    <span className="inline-flex items-center gap-2">
                      <Moon className="h-4 w-4" />
                      Dark
                    </span>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </section>

          <section className="space-y-3 rounded-[1.75rem] border border-border/60 bg-background/60 px-4 py-4">
            <div className="space-y-1">
              <p className="text-sm font-medium">Quick access</p>
              <p className="text-xs text-muted-foreground">
                Open the driver areas that matter most without crowding the main
                navigation.
              </p>
            </div>

            <div className="grid gap-2">
              <Button
                asChild
                variant="outline"
                className="h-11 justify-between rounded-full px-4"
              >
                <Link href="/driver/assigned">
                  <span className="inline-flex items-center gap-2">
                    <ClipboardList className="h-4 w-4" />
                    Assigned
                  </span>
                  <span className="text-xs text-muted-foreground">Open</span>
                </Link>
              </Button>
              <Button
                asChild
                variant="outline"
                className="h-11 justify-between rounded-full px-4"
              >
                <Link href="/driver/activity">
                  <span className="inline-flex items-center gap-2">
                    <Activity className="h-4 w-4" />
                    Activity
                  </span>
                  <span className="text-xs text-muted-foreground">Open</span>
                </Link>
              </Button>
              <Button
                asChild
                variant="outline"
                className="h-11 justify-between rounded-full px-4"
              >
                <Link href="/driver/toda">
                  <span className="inline-flex items-center gap-2">
                    <Clock3 className="h-4 w-4" />
                    TODA Queue
                  </span>
                  <span className="text-xs text-muted-foreground">Open</span>
                </Link>
              </Button>
            </div>
          </section>
        </div>

        <SheetFooter className="border-t border-border/60 px-5 py-4">
          <Button
            variant="outline"
            className="h-11 w-full justify-center gap-2 rounded-full"
            onClick={() => void handleLogout()}
            disabled={isLoggingOut}
          >
            <LogOut className="h-4 w-4" />
            {isLoggingOut ? 'Signing out...' : 'Sign out'}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
