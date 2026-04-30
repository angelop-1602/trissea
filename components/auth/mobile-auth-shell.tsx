import Link from 'next/link';
import type { ReactNode } from 'react';
import { BRAND_NAME, DEFAULT_BRAND_LOGO_PATH } from '@/lib/brand';
import { ReturnNavigation } from '@/components/return-navigation';
import { cn } from '@/lib/utils';

type MobileAuthTone = 'default' | 'passenger' | 'driver' | 'admin' | 'status';

interface MobileAuthShellProps {
  roleTag: string;
  title: string;
  subtitle: string;
  mode: 'login' | 'signup';
  backHref?: string;
  tone?: MobileAuthTone;
  loginHref: string;
  signupHref: string;
  loginLabel?: string;
  signupLabel?: string;
  showModeSwitch?: boolean;
  children: ReactNode;
  progress?: ReactNode;
  helper?: ReactNode;
}

const SHELL_THEME: Record<MobileAuthTone, { vars: string; aura: string; glow: string }> = {
  default: {
    vars: '',
    aura:
      'bg-[radial-gradient(circle_at_50%_12%,rgba(15,118,110,0.18),transparent_18rem)] dark:bg-[radial-gradient(circle_at_50%_12%,rgba(45,212,191,0.18),transparent_18rem)]',
    glow: 'bg-primary/10 dark:bg-primary/16',
  },
  passenger: {
    vars: 'theme-passenger',
    aura:
      'bg-[radial-gradient(circle_at_50%_12%,rgba(3,105,161,0.18),transparent_18rem)] dark:bg-[radial-gradient(circle_at_50%_12%,rgba(56,189,248,0.18),transparent_18rem)]',
    glow: 'bg-sky-500/10 dark:bg-sky-400/16',
  },
  driver: {
    vars: 'theme-driver',
    aura:
      'bg-[radial-gradient(circle_at_50%_12%,rgba(15,118,110,0.18),transparent_18rem)] dark:bg-[radial-gradient(circle_at_50%_12%,rgba(45,212,191,0.18),transparent_18rem)]',
    glow: 'bg-teal-500/10 dark:bg-teal-400/16',
  },
  admin: {
    vars:
      '[--background:#F8FAFC] [--foreground:#0F172A] [--card:#FFFFFF] [--card-foreground:#0F172A] [--popover:#FFFFFF] [--popover-foreground:#0F172A] [--primary:#334155] [--primary-foreground:#F8FAFC] [--secondary:#0369A1] [--secondary-foreground:#F8FAFC] [--muted:#E2E8F0] [--muted-foreground:#475569] [--accent:#DBEAFE] [--accent-foreground:#0F172A] [--border:#CBD5E1] [--input:#E2E8F0] [--ring:#0369A1] dark:[--background:#0F172A] dark:[--foreground:#E2E8F0] dark:[--card:#162334] dark:[--card-foreground:#E2E8F0] dark:[--popover:#162334] dark:[--popover-foreground:#E2E8F0] dark:[--primary:#94A3B8] dark:[--primary-foreground:#0F172A] dark:[--secondary:#38BDF8] dark:[--secondary-foreground:#082F49] dark:[--muted:#1E293B] dark:[--muted-foreground:#94A3B8] dark:[--accent:#12354A] dark:[--accent-foreground:#E2E8F0] dark:[--border:#334155] dark:[--input:rgba(148,163,184,0.14)] dark:[--ring:#38BDF8]',
    aura:
      'bg-[radial-gradient(circle_at_50%_12%,rgba(51,65,85,0.16),transparent_18rem)] dark:bg-[radial-gradient(circle_at_50%_12%,rgba(148,163,184,0.16),transparent_18rem)]',
    glow: 'bg-slate-500/10 dark:bg-slate-400/16',
  },
  status: {
    vars:
      '[--background:#FFFBEB] [--foreground:#78350F] [--card:#FFFFFF] [--card-foreground:#78350F] [--popover:#FFFFFF] [--popover-foreground:#78350F] [--primary:#D97706] [--primary-foreground:#FFFBEB] [--secondary:#B45309] [--secondary-foreground:#FFFBEB] [--muted:#FEF3C7] [--muted-foreground:#92400E] [--accent:#FDE68A] [--accent-foreground:#78350F] [--border:#FCD34D] [--input:#FDE68A] [--ring:#D97706] dark:[--background:#29180A] dark:[--foreground:#FEF3C7] dark:[--card:#3A2410] dark:[--card-foreground:#FEF3C7] dark:[--popover:#3A2410] dark:[--popover-foreground:#FEF3C7] dark:[--primary:#F59E0B] dark:[--primary-foreground:#2A1704] dark:[--secondary:#FBBF24] dark:[--secondary-foreground:#2A1704] dark:[--muted:#442A12] dark:[--muted-foreground:#FCD34D] dark:[--accent:#5B3712] dark:[--accent-foreground:#FEF3C7] dark:[--border:#92400E] dark:[--input:rgba(245,158,11,0.14)] dark:[--ring:#F59E0B]',
    aura:
      'bg-[radial-gradient(circle_at_50%_12%,rgba(217,119,6,0.16),transparent_18rem)] dark:bg-[radial-gradient(circle_at_50%_12%,rgba(245,158,11,0.18),transparent_18rem)]',
    glow: 'bg-amber-500/10 dark:bg-amber-400/16',
  },
};

export function MobileAuthShell({
  roleTag,
  title,
  subtitle,
  mode,
  backHref = '/',
  tone = 'default',
  loginHref,
  signupHref,
  loginLabel = 'Sign in',
  signupLabel = 'Sign up',
  showModeSwitch = true,
  children,
  progress,
  helper,
}: MobileAuthShellProps) {
  const theme = SHELL_THEME[tone];

  return (
    <div className={cn('relative min-h-screen overflow-hidden bg-background', theme.vars)}>
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,color-mix(in_oklab,var(--background),white_1%)_0%,var(--background)_78%)] dark:bg-[linear-gradient(180deg,color-mix(in_oklab,var(--background),black_4%)_0%,var(--background)_74%)]" />
      <div className={cn('pointer-events-none absolute inset-0', theme.aura)} />
      <div className="pointer-events-none absolute left-1/2 top-14 h-80 w-[42rem] -translate-x-1/2 rounded-full bg-primary/14 blur-[88px] dark:bg-primary/20" />
      <div
        className={cn(
          'pointer-events-none absolute left-1/2 top-20 h-72 w-72 -translate-x-1/2 rounded-full blur-3xl',
          theme.glow
        )}
      />

      <div className="relative mx-auto flex min-h-screen w-full max-w-md flex-col px-5 pb-7 pt-4 text-foreground">
        <header className="mb-5 space-y-5">
          <div className="flex items-start justify-start">
            <ReturnNavigation
              fallbackHref={backHref}
              className="h-10 w-10 rounded-full border border-border/60 bg-background/65 text-foreground shadow-[0_14px_34px_-24px_color-mix(in_oklab,var(--primary),black_35%)] backdrop-blur-xl hover:bg-background/78"
            />
          </div>

          <div className="flex min-w-0 items-center gap-3">
            <img
              src={DEFAULT_BRAND_LOGO_PATH}
              alt={`${BRAND_NAME} logo`}
              className="h-12 w-12 shrink-0 rounded-2xl object-cover shadow-[0_14px_34px_-24px_color-mix(in_oklab,var(--primary),black_35%)]"
            />
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold tracking-tight text-foreground">{BRAND_NAME}</p>
              <p className="truncate text-[11px] uppercase tracking-[0.18em] text-primary/85">{roleTag}</p>
            </div>
          </div>

          <div className="space-y-1 text-center">
            <h1 className="text-4xl font-semibold tracking-tight text-foreground">{title}</h1>
            <p className="text-sm text-muted-foreground">{subtitle}</p>
          </div>

          {showModeSwitch ? (
            <div className="mt-4 grid grid-cols-2 rounded-full border border-border/60 bg-background/45 p-1 backdrop-blur dark:border-white/10 dark:bg-white/6">
              <Link
                href={loginHref}
                className={cn(
                  'rounded-full px-3 py-2 text-center text-sm font-medium transition-colors',
                  mode === 'login'
                    ? 'bg-primary text-primary-foreground shadow-[0_10px_24px_-18px_color-mix(in_oklab,var(--primary),black_20%)]'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                {loginLabel}
              </Link>
              <Link
                href={signupHref}
                className={cn(
                  'rounded-full px-3 py-2 text-center text-sm font-medium transition-colors',
                  mode === 'signup'
                    ? 'bg-primary text-primary-foreground shadow-[0_10px_24px_-18px_color-mix(in_oklab,var(--primary),black_20%)]'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                {signupLabel}
              </Link>
            </div>
          ) : null}

          {progress ? <div className="mt-4">{progress}</div> : null}
        </header>

        <section className="space-y-4">
          <div className="space-y-4">{children}</div>
          {helper ? <div className="mt-5 border-t border-border/60 pt-4 text-sm text-muted-foreground dark:border-white/10">{helper}</div> : null}
        </section>
      </div>
    </div>
  );
}
