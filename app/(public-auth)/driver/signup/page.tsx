'use client';

import Link from 'next/link';
import { FormEvent, useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Building2,
  CarFront,
  Check,
  ChevronsUpDown,
  Home,
  IdCard,
  Mail,
  Palette,
  Phone,
  ShieldCheck,
  User,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { MobileAuthShell } from '@/components/auth/mobile-auth-shell';
import { AuthDatePicker } from '@/components/auth/auth-date-picker';
import { AuthInput } from '@/components/auth/auth-input';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { PendingButtonContent } from '@/components/ui/pending-button-content';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { getHomeRouteForUser, getTenantSuspendedRoute } from '@/lib/role-routes';
import { cn } from '@/lib/utils';

type LGUOption = {
  code: string;
  name: string;
  lguType: 'province' | 'city' | 'municipality';
  regionCode: string | null;
  regionName: string | null;
  provinceCode: string | null;
  provinceName: string | null;
};

const PHONE_PATTERN = /^\+?\d{10,15}$/;
const OTP_PATTERN = /^\d{4,8}$/;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const LGU_LABEL: Record<LGUOption['lguType'], string> = {
  province: 'Province',
  city: 'City',
  municipality: 'Municipality',
};

export default function DriverSignupPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [legalFullName, setLegalFullName] = useState('');
  const [email, setEmail] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [homeAddress, setHomeAddress] = useState('');
  const [membershipId, setMembershipId] = useState('');
  const [licenseNumber, setLicenseNumber] = useState('');
  const [licenseExpiry, setLicenseExpiry] = useState('');
  const [vehicleType, setVehicleType] = useState('');
  const [plateNumber, setPlateNumber] = useState('');
  const [vehicleModel, setVehicleModel] = useState('');
  const [vehicleColor, setVehicleColor] = useState('');
  const [phone, setPhone] = useState('');
  const [token, setToken] = useState('');
  const [agreeTerms, setAgreeTerms] = useState(false);
  const [lguQuery, setLguQuery] = useState('');
  const [lguOptions, setLguOptions] = useState<LGUOption[]>([]);
  const [selectedLgu, setSelectedLgu] = useState<LGUOption | null>(null);
  const [lguPickerOpen, setLguPickerOpen] = useState(false);
  const [lguLoading, setLguLoading] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const hasValidEmail = email.trim().length === 0 || EMAIL_PATTERN.test(email.trim());
  const isStep1Valid =
    legalFullName.trim().length >= 2 &&
    dateOfBirth.length > 0 &&
    homeAddress.trim().length >= 4 &&
    hasValidEmail;
  const isStep2Valid =
    selectedLgu !== null && licenseNumber.trim().length >= 4 && licenseExpiry.length > 0;
  const isStep3Valid =
    vehicleType.trim().length >= 2 &&
    plateNumber.trim().length >= 3 &&
    vehicleModel.trim().length >= 3 &&
    vehicleColor.trim().length >= 2 &&
    PHONE_PATTERN.test(phone.trim()) &&
    agreeTerms;
  const canVerifyOtp = OTP_PATTERN.test(token.trim());

  const progress = useMemo(
    () => (
      <div className="space-y-1.5">
        <div className="flex items-center gap-2">
          {[1, 2, 3, 4].map((item) => (
            <span
              key={item}
              className={`h-1.5 flex-1 rounded-full ${step >= item ? 'bg-primary' : 'bg-muted/50'}`}
            />
          ))}
        </div>
        <p className="text-center text-xs text-muted-foreground">Step {step} of 4</p>
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

  useEffect(() => {
    if (step !== 2) {
      return;
    }

    const trimmedQuery = lguQuery.trim();
    if (trimmedQuery.length < 2) {
      setLguOptions([]);
      setLguLoading(false);
      return;
    }

    const timer = setTimeout(async () => {
      setLguLoading(true);

      try {
        const response = await fetch(`/api/psgc/lgus?q=${encodeURIComponent(trimmedQuery)}`, {
          cache: 'no-store',
        });
        const payload = (await response.json().catch(() => ({}))) as {
          lgus?: LGUOption[];
          error?: string;
        };

        if (!response.ok) {
          setError(payload.error ?? 'Failed to load LGUs.');
          setLguOptions([]);
          return;
        }

        setLguOptions(payload.lgus ?? []);
      } finally {
        setLguLoading(false);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [lguQuery, step]);

  useEffect(() => {
    if (!selectedLgu) {
      return;
    }

    if (lguQuery.trim().toLowerCase() !== selectedLgu.name.toLowerCase()) {
      setSelectedLgu(null);
    }
  }, [lguQuery, selectedLgu]);

  const sendOtp = async () => {
    setError('');

    if (!isStep3Valid) {
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

      setStep(4);
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
          signupRole: 'driver',
          lguCode: selectedLgu?.code,
          legalFullName: legalFullName.trim(),
          email: email.trim(),
          dateOfBirth,
          homeAddress: homeAddress.trim(),
          todaMembershipId: membershipId.trim(),
          licenseNumber: licenseNumber.trim(),
          licenseExpiry,
          vehicleType: vehicleType.trim(),
          plateNumber: plateNumber.trim(),
          vehicleModel: vehicleModel.trim(),
          vehicleColor: vehicleColor.trim(),
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
        setError('This phone is already linked to a non-driver account.');
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
      title="Driver Sign Up"
      subtitle="Share your driver details, then verify your mobile number."
      mode="signup"
      tone="driver"
      backHref="/driver"
      loginHref="/driver/login"
      signupHref="/driver/signup"
      progress={progress}
      helper={
        <p className="text-center">
          Already a driver?{' '}
          <Link href="/driver/login" className="font-semibold text-foreground hover:text-primary">
            Sign in
          </Link>
        </p>
      }
    >
      {step === 1 ? (
        <div className="space-y-4">
          <AuthInput
            icon={User}
            placeholder="Legal full name"
            value={legalFullName}
            onChange={(event) => setLegalFullName(event.target.value)}
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
          <AuthDatePicker
            id="driver-date-of-birth"
            value={dateOfBirth}
            onChange={setDateOfBirth}
            placeholder="Pick date of birth"
          />
          <AuthInput
            icon={Home}
            placeholder="Home address"
            value={homeAddress}
            onChange={(event) => setHomeAddress(event.target.value)}
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
          <div className="space-y-2">
            <Popover open={lguPickerOpen} onOpenChange={setLguPickerOpen}>
              <PopoverTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  role="combobox"
                  aria-expanded={lguPickerOpen}
                  className="h-12 w-full justify-between rounded-2xl border-border/50 bg-background/60 px-3 text-sm font-normal text-foreground hover:bg-background/70"
                >
                  <span className="flex min-w-0 items-center gap-2">
                    <Building2 className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <span className={cn('truncate', lguQuery.trim().length === 0 && 'text-muted-foreground')}>
                      {lguQuery.trim().length > 0 ? lguQuery : 'Search LGU (at least 2 letters)'}
                    </span>
                  </span>
                  <ChevronsUpDown className="h-4 w-4 shrink-0 text-muted-foreground" />
                </Button>
              </PopoverTrigger>
              <PopoverContent align="start" className="w-[--radix-popover-trigger-width] p-0">
                <Command shouldFilter={false}>
                  <CommandInput
                    placeholder="Type LGU name..."
                    value={lguQuery}
                    onValueChange={(value) => {
                      setLguQuery(value);
                      setError('');
                    }}
                  />
                  <CommandList>
                    {lguLoading ? (
                      <p className="px-3 py-2 text-xs text-muted-foreground">Loading LGUs...</p>
                    ) : lguQuery.trim().length < 2 ? (
                      <p className="px-3 py-2 text-xs text-muted-foreground">
                        Type at least 2 letters to search.
                      </p>
                    ) : lguOptions.length === 0 ? (
                      <CommandEmpty>No LGU found.</CommandEmpty>
                    ) : (
                      <CommandGroup heading="LGU results">
                        {lguOptions.map((lgu) => (
                          <CommandItem
                            key={lgu.code}
                            value={`${lgu.name} ${lgu.regionName ?? ''} ${lgu.provinceName ?? ''}`}
                            className="items-start justify-between gap-2 py-2"
                            onSelect={() => {
                              setSelectedLgu(lgu);
                              setLguQuery(lgu.name);
                              setLguPickerOpen(false);
                              setError('');
                            }}
                          >
                            <div className="min-w-0">
                              <p className="truncate text-sm">{lgu.name}</p>
                              <p className="text-xs text-muted-foreground">
                                {lgu.regionName ?? 'Unknown Region'}
                                {lgu.provinceName ? ` | Province: ${lgu.provinceName}` : ''}
                              </p>
                            </div>
                            <div className="flex shrink-0 items-center gap-2">
                              <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
                                {LGU_LABEL[lgu.lguType]}
                              </span>
                              <Check
                                className={cn(
                                  'h-4 w-4 text-primary',
                                  selectedLgu?.code === lgu.code ? 'opacity-100' : 'opacity-0'
                                )}
                              />
                            </div>
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    )}
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
            <p className="text-xs text-muted-foreground">Terminal assignment follows LGU mapping.</p>
          </div>

          <AuthInput
            icon={IdCard}
            placeholder="TODA membership ID (optional)"
            value={membershipId}
            onChange={(event) => setMembershipId(event.target.value)}
          />
          <AuthInput
            icon={IdCard}
            placeholder="License number"
            value={licenseNumber}
            onChange={(event) => setLicenseNumber(event.target.value)}
            required
          />
          <AuthDatePicker
            id="driver-license-expiry"
            value={licenseExpiry}
            onChange={setLicenseExpiry}
            placeholder="Pick license expiration date"
          />

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
              disabled={!isStep2Valid}
              onClick={() => {
                setError('');
                setStep(3);
              }}
            >
              <span className="inline-flex items-center gap-2">
                Continue
                <ArrowRight className="h-4 w-4" />
              </span>
            </Button>
          </div>
        </div>
      ) : null}

      {step === 3 ? (
        <div className="space-y-4">
          <AuthInput
            icon={CarFront}
            placeholder="Vehicle type"
            value={vehicleType}
            onChange={(event) => setVehicleType(event.target.value)}
            required
          />
          <AuthInput
            icon={CarFront}
            placeholder="Plate number"
            value={plateNumber}
            onChange={(event) => setPlateNumber(event.target.value)}
            required
          />
          <AuthInput
            icon={CarFront}
            placeholder="Vehicle make and model"
            value={vehicleModel}
            onChange={(event) => setVehicleModel(event.target.value)}
            required
          />
          <AuthInput
            icon={Palette}
            placeholder="Vehicle color"
            value={vehicleColor}
            onChange={(event) => setVehicleColor(event.target.value)}
            required
          />
          <AuthInput
            icon={Phone}
            type="tel"
            placeholder="Driver mobile number"
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
            autoComplete="tel"
            required
          />

          <label className="flex items-start gap-3 rounded-2xl border border-border/40 bg-background/30 px-3 py-2.5">
            <Checkbox checked={agreeTerms} onCheckedChange={(checked) => setAgreeTerms(checked === true)} />
            <span className="text-xs leading-5 text-muted-foreground">
              I agree to driver onboarding checks and Mobility terms and privacy policy.
            </span>
          </label>

          <div className="grid grid-cols-2 gap-2">
            <Button
              type="button"
              variant="outline"
              className="h-12 rounded-full border-border/40 bg-background/30 text-foreground hover:bg-background/50"
              onClick={() => {
                setError('');
                setStep(2);
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
              disabled={loading || !isStep3Valid}
              onClick={() => void sendOtp()}
            >
              <PendingButtonContent pending={loading} label="Send OTP" />
            </Button>
          </div>
        </div>
      ) : null}

      {step === 4 ? (
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
              setStep(3);
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
