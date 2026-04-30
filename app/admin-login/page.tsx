'use client';

import { FormEvent, useEffect, useState } from 'react';
import { LockKeyhole, Mail } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { MobileAuthShell } from '@/components/auth/mobile-auth-shell';
import { AuthInput } from '@/components/auth/auth-input';
import { Button } from '@/components/ui/button';
import { PendingButtonContent } from '@/components/ui/pending-button-content';
import { getHomeRouteForUser, getTenantSuspendedRoute } from '@/lib/role-routes';

export default function AdminLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let active = true;

    const checkSession = async () => {
      const response = await fetch('/api/me', { cache: 'no-store' });
      const payload = await response.json().catch(() => ({}));

      if (!active) {
        return;
      }

      if (!response.ok && payload.code === 'TENANT_SUSPENDED') {
        router.replace(
          getTenantSuspendedRoute({
            role: 'admin',
            message: typeof payload.error === 'string' ? payload.error : null,
          })
        );
        return;
      }

      if (response.ok && payload.user?.role) {
        router.replace(getHomeRouteForUser(payload.user, payload.transportModules));
      }
    };

    void checkSession();

    return () => {
      active = false;
    };
  }, [router]);

  const signIn = async (event: FormEvent) => {
    event.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await fetch('/api/auth/email/login', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          email: email.trim(),
          password,
        }),
      });
      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        setError(payload.error ?? 'Invalid email or password.');
        return;
      }

      const meResponse = await fetch('/api/me', { cache: 'no-store' });
      const mePayload = await meResponse.json().catch(() => ({}));

      if (!meResponse.ok && mePayload.code === 'TENANT_SUSPENDED') {
        router.replace(
          getTenantSuspendedRoute({
            role: 'admin',
            message: typeof mePayload.error === 'string' ? mePayload.error : null,
          })
        );
        return;
      }

      if (!meResponse.ok || !mePayload.user?.role) {
        setError(mePayload.error ?? 'Failed to load user profile.');
        return;
      }

      router.replace(getHomeRouteForUser(mePayload.user, mePayload.transportModules));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Invalid email or password.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <MobileAuthShell
      roleTag="Admin Access"
      title="Control Center Sign In"
      subtitle="Sign in with your admin or superadmin email to continue into the workspace."
      mode="login"
      tone="admin"
      backHref="/"
      loginHref="/admin-login"
      signupHref="/"
      loginLabel="Admin sign in"
      signupLabel="Role Entry"
      showModeSwitch={false}
    >
      <form className="space-y-4" onSubmit={signIn}>
        <AuthInput
          icon={Mail}
          id="email"
          type="email"
          autoComplete="email"
          placeholder="Your email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          required
        />

        <AuthInput
          icon={LockKeyhole}
          id="password"
          type="password"
          autoComplete="current-password"
          placeholder="Your password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          required
        />

        <Button
          type="submit"
          className="h-12 w-full rounded-full bg-primary font-semibold text-primary-foreground hover:bg-primary/90"
          size="lg"
          disabled={loading}
        >
          <PendingButtonContent pending={loading} label="Sign in" />
        </Button>

        {error ? <p className="text-sm text-destructive">{error}</p> : null}
      </form>
    </MobileAuthShell>
  );
}
