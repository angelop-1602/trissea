'use client';

import Link from 'next/link';
import { FormEvent, useEffect, useState } from 'react';
import { Phone, ShieldCheck } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { MobileAuthShell } from '@/components/auth/mobile-auth-shell';
import { AuthInput } from '@/components/auth/auth-input';
import { Button } from '@/components/ui/button';
import { PendingButtonContent } from '@/components/ui/pending-button-content';
import { normalizePhilippinePhoneInput } from '@/lib/auth/phone';
import { getHomeRouteForUser, getTenantSuspendedRoute } from '@/lib/role-routes';

const PHONE_PATTERN = /^\+?\d{10,15}$/;
const OTP_PATTERN = /^\d{4,8}$/;

export default function DriverLoginPage() {
  const router = useRouter();
  const [phone, setPhone] = useState('');
  const [token, setToken] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const normalizedPhone = normalizePhilippinePhoneInput(phone);
  const canSendOtp = PHONE_PATTERN.test(normalizedPhone);
  const canVerifyOtp = OTP_PATTERN.test(token.trim());

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
            role: 'driver',
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

  const sendOtp = async (event: FormEvent) => {
    event.preventDefault();
    setError('');

    if (!canSendOtp) {
      setError('Enter a valid driver mobile number before requesting OTP.');
      return;
    }

    setLoading(true);

    try {
      const response = await fetch('/api/auth/sms/send', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
        },
        body: JSON.stringify({ phone: normalizedPhone }),
      });
      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        setError(payload.error ?? 'Failed to send OTP.');
        return;
      }

      setOtpSent(true);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Failed to send OTP.');
    } finally {
      setLoading(false);
    }
  };

  const verifyOtp = async (event: FormEvent) => {
    event.preventDefault();
    setError('');

    if (!canVerifyOtp) {
      setError('Enter the OTP code sent to your phone.');
      return;
    }

    setLoading(true);

    try {
      const verifyResponse = await fetch('/api/auth/sms/verify', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          phone: normalizedPhone,
          token: token.trim(),
          authFlow: 'login',
          expectedRole: 'driver',
        }),
      });
      const verifyPayload = await verifyResponse.json().catch(() => ({}));

      if (!verifyResponse.ok) {
        setError(verifyPayload.error ?? 'Invalid OTP.');
        return;
      }

      const meResponse = await fetch('/api/me', { cache: 'no-store' });
      const mePayload = await meResponse.json().catch(() => ({}));

      if (!meResponse.ok && mePayload.code === 'TENANT_SUSPENDED') {
        router.replace(
          getTenantSuspendedRoute({
            role: 'driver',
            message: typeof mePayload.error === 'string' ? mePayload.error : null,
          })
        );
        return;
      }

      if (!meResponse.ok || !mePayload.user?.role) {
        setError(mePayload.error ?? 'Failed to load user profile.');
        return;
      }

      if (mePayload.user.role !== 'driver') {
        await fetch('/api/auth/logout', { method: 'POST' });
        setError('This mobile number is not linked to a driver account.');
        setOtpSent(false);
        setToken('');
        return;
      }

      router.replace(getHomeRouteForUser(mePayload.user, mePayload.transportModules));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Invalid OTP.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <MobileAuthShell
      roleTag="Driver Access"
      title="Driver Sign In"
      subtitle="Sign in to receive bookings, queue requests, and trip updates."
      mode="login"
      tone="driver"
      backHref="/driver"
      loginHref="/driver/login"
      signupHref="/driver/signup"
    >
      {!otpSent ? (
        <form className="space-y-4" onSubmit={sendOtp}>
          <AuthInput
            icon={Phone}
            type="tel"
            placeholder="Driver mobile number"
            value={phone}
            onChange={(event) => setPhone(normalizePhilippinePhoneInput(event.target.value))}
            autoComplete="tel"
            required
          />

          <Button
            type="submit"
            className="h-12 w-full rounded-full bg-primary font-semibold text-primary-foreground hover:bg-primary/90"
            disabled={loading || !canSendOtp}
          >
            <PendingButtonContent pending={loading} label="Send OTP" />
          </Button>
        </form>
      ) : (
        <form className="space-y-4" onSubmit={verifyOtp}>
          <AuthInput
            icon={ShieldCheck}
            inputMode="numeric"
            autoComplete="one-time-code"
            placeholder="Enter OTP code"
            value={token}
            onChange={(event) => setToken(event.target.value)}
            required
          />

          <Button
            type="submit"
            className="h-12 w-full rounded-full bg-primary font-semibold text-primary-foreground hover:bg-primary/90"
            disabled={loading || !canVerifyOtp}
          >
            <PendingButtonContent pending={loading} label="Verify and Continue" />
          </Button>

          <Button
            type="button"
            variant="outline"
            className="h-12 w-full rounded-full border-border/40 bg-background/30 text-foreground hover:bg-background/50"
            onClick={() => {
              setOtpSent(false);
              setToken('');
              setError('');
            }}
            disabled={loading}
          >
            Use a different number
          </Button>
        </form>
      )}

      {error ? (
        <p className="rounded-2xl border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      ) : null}

      <div className="space-y-1 text-center text-sm text-muted-foreground">
        <p>
          Need a driver account?{' '}
          <Link href="/driver/signup" className="font-semibold text-foreground hover:text-primary">
            Sign up
          </Link>
        </p>
      </div>
    </MobileAuthShell>
  );
}
