'use client';

import Link from 'next/link';
import { FormEvent, useEffect, useMemo, useState } from 'react';
import { ArrowLeft, ArrowRight, Mail, Phone, ShieldCheck, User, UserRound } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { MobileAuthShell } from '@/components/auth/mobile-auth-shell';
import { AuthInput } from '@/components/auth/auth-input';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { PendingButtonContent } from '@/components/ui/pending-button-content';
import { getHomeRouteForUser, getTenantSuspendedRoute } from '@/lib/role-routes';

const PHONE_PATTERN = /^\+?\d{10,15}$/;
const OTP_PATTERN = /^\d{4,8}$/;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function PassengerSignupPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [emergencyName, setEmergencyName] = useState('');
  const [emergencyPhone, setEmergencyPhone] = useState('');
  const [token, setToken] = useState('');
  const [agreeTerms, setAgreeTerms] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const isEmailValid = email.trim().length === 0 || EMAIL_PATTERN.test(email.trim());
  const isStep1Valid = fullName.trim().length >= 2 && isEmailValid && PHONE_PATTERN.test(phone.trim());
  const isStep2Valid =
    emergencyName.trim().length >= 2 &&
    PHONE_PATTERN.test(emergencyPhone.trim()) &&
    agreeTerms;
  const canVerifyOtp = OTP_PATTERN.test(token.trim());

  const progress = useMemo(
    () => (
      <div className="space-y-1.5">
        <div className="flex items-center gap-2">
          {[1, 2, 3].map((item) => (
            <span
              key={item}
              className={`h-1.5 flex-1 rounded-full ${step >= item ? 'bg-primary' : 'bg-muted/50'}`}
            />
          ))}
        </div>
        <p className="text-center text-xs text-muted-foreground">Step {step} of 3</p>
      </div>
    ),
    [step]
  );

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
            role: 'passenger',
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

  const sendOtp = async () => {
    setError('');

    if (!isStep2Valid) {
      setError('Complete required fields before requesting OTP.');
      return;
    }

    setLoading(true);

    try {
      const response = await fetch('/api/auth/sms/send', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
        },
        body: JSON.stringify({ phone: phone.trim() }),
      });
      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        setError(payload.error ?? 'Failed to send OTP.');
        return;
      }

      setStep(3);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Failed to send OTP.');
    } finally {
      setLoading(false);
    }
  };

  const verifyOtpAndSignup = async (event: FormEvent) => {
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
          phone: phone.trim(),
          token: token.trim(),
          signupRole: 'passenger',
          fullName: fullName.trim(),
          email: email.trim(),
          emergencyName: emergencyName.trim(),
          emergencyPhone: emergencyPhone.trim(),
          acceptedTerms: agreeTerms,
        }),
      });
      const verifyPayload = await verifyResponse.json().catch(() => ({}));

      if (!verifyResponse.ok) {
        setError(verifyPayload.error ?? 'Invalid OTP.');
        return;
      }

      router.replace('/passenger/signup/complete');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Invalid OTP.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <MobileAuthShell
      roleTag="Passenger Access"
      title="Passenger Sign Up"
      subtitle="Set up your passenger account in a few short steps."
      mode="signup"
      tone="passenger"
      backHref="/passenger"
      loginHref="/passenger/login"
      signupHref="/passenger/signup"
      progress={progress}
      helper={
        <p className="text-center">
          Already a passenger?{' '}
          <Link href="/passenger/login" className="font-semibold text-foreground hover:text-primary">
            Sign in
          </Link>
        </p>
      }
    >
      {step === 1 ? (
        <div className="space-y-4">
          <AuthInput
            icon={User}
            placeholder="Full name"
            value={fullName}
            onChange={(event) => setFullName(event.target.value)}
            autoComplete="name"
            required
          />
          <AuthInput
            icon={Mail}
            type="email"
            placeholder="Email (optional)"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            autoComplete="email"
          />
          <AuthInput
            icon={Phone}
            type="tel"
            placeholder="Your mobile number"
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
            autoComplete="tel"
            required
          />

          <Button
            type="button"
            className="h-12 w-full rounded-full bg-primary font-semibold text-primary-foreground hover:bg-primary/90"
            disabled={!isStep1Valid}
            onClick={() => {
              setError('');
              setStep(2);
            }}
          >
            <span className="inline-flex items-center gap-2">
              Continue
              <ArrowRight className="h-4 w-4" />
            </span>
          </Button>
        </div>
      ) : null}

      {step === 2 ? (
        <div className="space-y-4">
          <AuthInput
            icon={UserRound}
            placeholder="Emergency contact name"
            value={emergencyName}
            onChange={(event) => setEmergencyName(event.target.value)}
            required
          />
          <AuthInput
            icon={Phone}
            type="tel"
            placeholder="Emergency contact phone"
            value={emergencyPhone}
            onChange={(event) => setEmergencyPhone(event.target.value)}
            autoComplete="tel"
            required
          />

          <label className="flex items-start gap-3 rounded-2xl border border-border/40 bg-background/30 px-3 py-2.5">
            <Checkbox checked={agreeTerms} onCheckedChange={(checked) => setAgreeTerms(checked === true)} />
            <span className="text-xs leading-5 text-muted-foreground">
              I agree to Mobility terms of service and privacy policy.
            </span>
          </label>

          <div className="grid grid-cols-2 gap-2">
            <Button
              type="button"
              variant="outline"
              className="h-12 rounded-full border-border/40 bg-background/30 text-foreground hover:bg-background/50"
              onClick={() => {
                setError('');
                setStep(1);
              }}
            >
              <span className="inline-flex items-center gap-2">
                <ArrowLeft className="h-4 w-4" />
                Back
              </span>
            </Button>
            <Button
              type="button"
              className="h-12 rounded-full bg-primary font-semibold text-primary-foreground hover:bg-primary/90"
              disabled={loading || !isStep2Valid}
              onClick={() => void sendOtp()}
            >
              <PendingButtonContent pending={loading} label="Send OTP" />
            </Button>
          </div>
        </div>
      ) : null}

      {step === 3 ? (
        <form className="space-y-4" onSubmit={verifyOtpAndSignup}>
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
            <PendingButtonContent pending={loading} label="Verify and Finish Sign Up" />
          </Button>

          <Button
            type="button"
            variant="outline"
            className="h-12 w-full rounded-full border-border/40 bg-background/30 text-foreground hover:bg-background/50"
            onClick={() => {
              setError('');
              setStep(2);
              setToken('');
            }}
            disabled={loading}
          >
            Edit previous details
          </Button>
        </form>
      ) : null}

      {error ? (
        <p className="rounded-2xl border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      ) : null}

    </MobileAuthShell>
  );
}
