'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Clock3, Loader2, LogOut, ShieldAlert } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { getHomeRouteForUser, getTenantSuspendedRoute } from '@/lib/role-routes';

type DriverStatusState =
  | {
      kind: 'loading';
    }
  | {
      kind: 'pending';
      name: string;
    }
  | {
      kind: 'restricted';
      name: string;
      reason: string | null;
      restrictedAt: string | Date | null;
    }
  | {
      kind: 'error';
      message: string;
    };

function formatDateTime(value: string | Date | null) {
  if (!value) {
    return 'Unavailable';
  }

  return new Date(value).toLocaleString();
}

export default function DriverStatusPage() {
  const router = useRouter();
  const [status, setStatus] = useState<DriverStatusState>({ kind: 'loading' });

  useEffect(() => {
    let active = true;

    const loadProfile = async () => {
      const response = await fetch('/api/me', { cache: 'no-store' });
      const payload = await response.json().catch(() => ({}));

      if (!active) return;

      if (response.status === 401 || response.status === 404) {
        router.replace('/driver/login');
        return;
      }

      if (!response.ok && payload.code === 'TENANT_SUSPENDED') {
        router.replace(
          getTenantSuspendedRoute({
            role: 'driver',
            message: typeof payload.error === 'string' ? payload.error : null,
          })
        );
        return;
      }

      if (!response.ok || !payload.user?.role) {
        setStatus({
          kind: 'error',
          message: payload.error ?? 'Unable to load your driver access status right now.',
        });
        return;
      }

      if (payload.user.role !== 'driver') {
        router.replace(getHomeRouteForUser(payload.user, payload.transportModules));
        return;
      }

      if (
        payload.user.isDriverVerified &&
        !payload.user.isDriverRestricted
      ) {
        router.replace(getHomeRouteForUser(payload.user, payload.transportModules));
        return;
      }

      if (payload.user.isDriverRestricted) {
        setStatus({
          kind: 'restricted',
          name: payload.user.name ?? 'Driver',
          reason: payload.user.driverRestrictionReason ?? null,
          restrictedAt: payload.user.driverRestrictedAt ?? null,
        });
        return;
      }

      setStatus({
        kind: 'pending',
        name: payload.user.name ?? 'Driver',
      });
    };

    void loadProfile();

    return () => {
      active = false;
    };
  }, [router]);

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.replace('/driver/login');
  };

  if (status.kind === 'loading') {
    return (
      <main className="theme-driver flex min-h-screen items-center justify-center bg-gradient-to-b from-primary/5 to-background px-4 py-10">
        <Card className="w-full max-w-xl">
          <CardHeader>
            <CardTitle>Checking Driver Access</CardTitle>
            <CardDescription>Loading your current driver account status.</CardDescription>
          </CardHeader>
          <CardContent className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>Please wait while we verify your account state.</span>
          </CardContent>
        </Card>
      </main>
    );
  }

  if (status.kind === 'error') {
    return (
      <main className="theme-driver flex min-h-screen items-center justify-center bg-gradient-to-b from-primary/5 to-background px-4 py-10">
        <Card className="w-full max-w-xl">
          <CardHeader>
            <CardTitle>Driver Access Unavailable</CardTitle>
            <CardDescription>We could not confirm your driver access state.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
              {status.message}
            </p>
            <div className="grid gap-2 sm:grid-cols-2">
              <Button type="button" onClick={() => router.refresh()}>
                Retry
              </Button>
              <Button asChild variant="outline">
                <Link href="/driver/login">Back to Driver Sign In</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </main>
    );
  }

  const isRestricted = status.kind === 'restricted';
  const driverName = status.name;

  return (
    <main className="theme-driver flex min-h-screen items-center justify-center bg-gradient-to-b from-primary/5 to-background px-4 py-10">
      <Card className="w-full max-w-xl">
        <CardHeader>
          <CardTitle>Driver Account Status</CardTitle>
          <CardDescription>
            {isRestricted
              ? `${driverName}, your account cannot access operational driver screens right now.`
              : `${driverName}, your account is waiting for admin verification before you can go online.`}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {isRestricted ? (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950">
              <div className="flex items-center gap-2 font-medium">
                <ShieldAlert className="h-4 w-4" />
                Restricted
              </div>
              <p className="mt-1 text-xs text-amber-900/80">
                An administrator has temporarily restricted your driver operations.
              </p>
            </div>
          ) : (
            <div className="status-pending rounded-lg border p-3 text-sm">
              <div className="flex items-center gap-2 font-medium">
                <Clock3 className="h-4 w-4" />
                Pending Review
              </div>
              <p className="mt-1 text-xs opacity-80">
                Your submitted documents are waiting for admin verification.
              </p>
            </div>
          )}

          {isRestricted ? (
            <div className="rounded-lg border border-border bg-card p-3 text-sm text-foreground">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                Restriction Reason
              </p>
              <p className="mt-2 text-sm font-medium">
                {status.reason?.trim() || 'No reason was provided by the administrator.'}
              </p>
              <p className="mt-3 text-xs text-muted-foreground">
                Restricted at {formatDateTime(status.restrictedAt)}
              </p>
            </div>
          ) : (
            <div className="rounded-lg border border-border bg-card p-3 text-sm text-foreground">
              <p className="text-sm font-medium">Next Steps</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Your registration has been received. A tenant admin still needs to review and approve
                your driver account before you can receive operational trips.
              </p>
            </div>
          )}

          <div className="grid gap-2 sm:grid-cols-2">
            <Button type="button" onClick={() => void handleLogout()}>
              <LogOut className="h-4 w-4" />
              Sign out
            </Button>
            <Button asChild variant="outline">
              <Link href="/">Return Home</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </main>
  );
}
