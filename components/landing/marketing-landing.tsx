'use client';

import Link from 'next/link';
import { useEffect, useRef } from 'react';
import {
  ArrowRight,
  BadgeCheck,
  CheckCircle2,
  ClipboardCheck,
  Clock3,
  LayoutDashboard,
  LockKeyhole,
  MapPinned,
  ShieldCheck,
  Smartphone,
  Sparkles,
} from 'lucide-react';
import { ReturnNavigation } from '@/components/return-navigation';
import { Button } from '@/components/ui/button';
import {
  LANDING_APP_CHOICES,
  LANDING_BENEFITS,
  LANDING_HERO,
  LANDING_PRIMARY_CTA,
  LANDING_STEPS,
  LANDING_TRUST_ITEMS,
} from '@/lib/landing-content';
import { BRAND_NAME, DEFAULT_BRAND_LOGO_PATH, PLATFORM_NAME } from '@/lib/brand';
import { cn } from '@/lib/utils';

const benefitIcons = [MapPinned, Clock3, ClipboardCheck] as const;
const trustIcons = [LockKeyhole, BadgeCheck, ShieldCheck, Smartphone] as const;

const heroBackdropStyle = {
  backgroundImage:
    'radial-gradient(circle at 18% 18%, rgba(3, 105, 161, 0.18), transparent 32%), radial-gradient(circle at 84% 10%, rgba(15, 118, 110, 0.18), transparent 34%), linear-gradient(180deg, rgba(255, 255, 255, 0.04), transparent 72%)',
};

export function MarketingLanding() {
  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!rootRef.current || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      return;
    }

    let cancelled = false;
    let scope: { revert: () => void } | null = null;

    void import('animejs')
      .then(({ animate, createScope, stagger }) => {
        if (cancelled || !rootRef.current) {
          return;
        }

        scope = createScope({ root: rootRef.current }).add(() => {
          animate('.landing-reveal', {
            opacity: [0, 1],
            y: [18, 0],
            duration: 700,
            delay: stagger(70),
            ease: 'out(3)',
          });
          animate('.landing-card-reveal', {
            opacity: [0, 1],
            y: [16, 0],
            duration: 620,
            delay: stagger(45),
            ease: 'out(3)',
          });
          animate('.landing-float', {
            y: [-6, 6],
            duration: 2800,
            alternate: true,
            loop: true,
            ease: 'inOutSine',
          });
          animate('.landing-pulse', {
            scale: [1, 1.04, 1],
            duration: 2400,
            loop: true,
            ease: 'inOutSine',
          });
        });
      })
      .catch(() => undefined);

    return () => {
      cancelled = true;
      scope?.revert();
    };
  }, []);

  return (
    <div ref={rootRef} className="min-h-screen overflow-hidden bg-background text-foreground">
      <header className="sticky top-0 z-50 border-b border-border/60 bg-background/84 backdrop-blur-xl supports-[backdrop-filter]:bg-background/76">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <ReturnNavigation
              fallbackHref="/"
              className="h-10 w-10 rounded-full border border-border/60 bg-background/76 text-foreground backdrop-blur-xl hover:bg-card"
            />

            <Link
              href="/"
              className="flex items-center gap-3 rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
              <div className="flex h-11 w-11 items-center justify-center rounded-[1.1rem] border border-border/70 bg-card/90 p-1 shadow-sm">
                <img
                  src={DEFAULT_BRAND_LOGO_PATH}
                  alt={`${BRAND_NAME} logo`}
                  className="h-full w-full rounded-[0.9rem] object-cover"
                />
              </div>
              <div className="leading-tight">
                <p className="text-sm font-black tracking-[0.18em] text-foreground">{BRAND_NAME}</p>
                <p className="hidden text-xs font-medium text-muted-foreground sm:block">Mobility platform</p>
              </div>
            </Link>
          </div>

          <nav
            aria-label="Landing navigation"
            className="hidden items-center gap-6 text-sm font-medium text-muted-foreground md:flex"
          >
            <Link href="#benefits" className="transition-colors hover:text-secondary">
              Benefits
            </Link>
            <Link href="#how-it-works" className="transition-colors hover:text-secondary">
              How it works
            </Link>
            <Link href="#trust" className="transition-colors hover:text-secondary">
              Trust
            </Link>
          </nav>

          <Button asChild className="rounded-full bg-primary px-5 text-primary-foreground hover:bg-primary/90">
            <Link href={LANDING_PRIMARY_CTA.href}>{LANDING_PRIMARY_CTA.label}</Link>
          </Button>
        </div>
      </header>

      <main>
        <section className="relative px-4 pb-20 pt-10 sm:px-6 sm:pb-24 sm:pt-16 lg:px-8">
          <div className="absolute inset-x-0 top-0 -z-10 h-[38rem]" style={heroBackdropStyle} />
          <div className="mx-auto grid max-w-7xl items-center gap-12 lg:grid-cols-[1.02fr_0.98fr]">
            <div className="max-w-3xl">
              <div className="landing-reveal mb-5 inline-flex items-center gap-2 rounded-full border border-border/70 bg-card/80 px-3 py-1.5 text-xs font-bold uppercase tracking-[0.18em] text-secondary shadow-sm">
                <Sparkles className="h-3.5 w-3.5" />
                {LANDING_HERO.eyebrow}
              </div>
              <h1 className="landing-reveal text-balance text-5xl font-black leading-[0.96] tracking-[-0.05em] text-foreground sm:text-6xl lg:text-7xl">
                {LANDING_HERO.headline}
              </h1>
              <p className="landing-reveal mt-6 max-w-2xl text-pretty text-lg leading-8 text-muted-foreground sm:text-xl">
                {LANDING_HERO.subheadline}
              </p>

              <div className="landing-reveal mt-8 flex flex-col gap-3 sm:flex-row">
                <Button
                  asChild
                  size="lg"
                  className="h-12 rounded-full bg-primary px-7 text-base font-bold text-primary-foreground shadow-xl shadow-primary/20 hover:bg-primary/90"
                >
                  <Link href={LANDING_PRIMARY_CTA.href}>
                    {LANDING_PRIMARY_CTA.label}
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
                <Button
                  asChild
                  size="lg"
                  variant="outline"
                  className="h-12 rounded-full border-border bg-card/70 px-7 text-base font-bold text-foreground hover:bg-card"
                >
                  <Link href="#how-it-works">See how it works</Link>
                </Button>
              </div>

              <div className="landing-reveal mt-8 flex flex-wrap gap-x-6 gap-y-3 text-sm text-muted-foreground">
                {['Passenger onboarding', 'Driver operations', 'Installable PWA'].map((item) => (
                  <div key={item} className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 shrink-0 text-primary" />
                    <span>{item}</span>
                  </div>
                ))}
              </div>
            </div>

            <ProductMockup />
          </div>
        </section>

        <section id="benefits" className="px-4 py-14 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-7xl">
            <SectionIntro
              label="Why it matters"
              title="Make the next step obvious"
              description={`${BRAND_NAME} keeps the first choice simple, then sends each person into the flow built for their role.`}
            />

            <div className="mt-10 grid gap-8 border-t border-border/70 pt-8 md:grid-cols-3">
              {LANDING_BENEFITS.map((benefit, index) => {
                const Icon = benefitIcons[index] ?? CheckCircle2;
                const withDivider = index < LANDING_BENEFITS.length - 1;

                return (
                  <article
                    key={benefit.title}
                    className={cn(
                      'landing-card-reveal relative pr-0 md:pr-8',
                      withDivider && 'md:border-r md:border-border/60'
                    )}
                  >
                    <div className="mb-5 inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-secondary/12 text-secondary">
                      <Icon className="h-6 w-6" />
                    </div>
                    <h3 className="text-xl font-black tracking-[-0.02em] text-foreground">{benefit.title}</h3>
                    <p className="mt-3 leading-7 text-muted-foreground">{benefit.description}</p>
                  </article>
                );
              })}
            </div>
          </div>
        </section>

        <section id="how-it-works" className="px-4 py-14 sm:px-6 lg:px-8">
          <div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-[0.78fr_1.22fr] lg:items-start">
            <SectionIntro
              label="How it works"
              title="Three simple moves"
              description="The landing page does not ask people to understand the whole platform. It helps them choose the right door."
            />

            <div className="landing-reveal relative pl-8">
              <div className="absolute bottom-2 left-3 top-2 w-px bg-border/70" />
              <div className="space-y-8">
                {LANDING_STEPS.map((step, index) => (
                  <article key={step.title} className="landing-card-reveal relative">
                    <div className="absolute -left-8 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-primary text-[11px] font-black text-primary-foreground">
                      {index + 1}
                    </div>
                    <h3 className="text-lg font-black tracking-[-0.02em] text-foreground">{step.title}</h3>
                    <p className="mt-3 max-w-xl text-sm leading-6 text-muted-foreground">{step.description}</p>
                  </article>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section id="trust" className="px-4 py-14 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-7xl">
            <SectionIntro
              label="Built for trust"
              title="Clear access, safer operations"
              description="No inflated numbers here. These are the platform safeguards already reflected in the product direction."
            />

            <div className="mt-10 grid gap-x-10 gap-y-6 border-t border-border/70 pt-8 sm:grid-cols-2">
              {LANDING_TRUST_ITEMS.map((item, index) => {
                const Icon = trustIcons[index] ?? ShieldCheck;

                return (
                  <article key={item.title} className="landing-card-reveal flex items-start gap-4">
                    <div className="mt-0.5 inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                      <Icon className="h-5 w-5" />
                    </div>
                    <div>
                      <h3 className="font-black text-foreground">{item.title}</h3>
                      <p className="mt-2 text-sm leading-6 text-muted-foreground">{item.description}</p>
                    </div>
                  </article>
                );
              })}
            </div>
          </div>
        </section>

        <section id="choose-app" className="px-4 py-16 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-7xl rounded-[2.75rem] border border-border/70 bg-card/88 p-6 shadow-[0_28px_80px_-48px_rgba(2,6,23,0.5)] backdrop-blur sm:p-8 lg:p-10">
            <div className="grid gap-8 lg:grid-cols-[0.82fr_1.18fr] lg:items-start">
              <div>
                <p className="text-sm font-black uppercase tracking-[0.18em] text-secondary">Choose your app</p>
                <h2 className="mt-3 text-4xl font-black tracking-[-0.04em] text-foreground sm:text-5xl">
                  Start with the role that matches you
                </h2>
                <p className="mt-4 max-w-xl leading-7 text-muted-foreground">
                  Passenger and Driver feel like separate app entries now, while the platform stays ready for future transport modules.
                </p>
              </div>

              <div className="grid gap-6 md:grid-cols-2">
                {LANDING_APP_CHOICES.map((choice, index) => {
                  const isPassenger = choice.role === 'passenger';

                  return (
                    <article
                      key={choice.role}
                      className={cn(
                        'landing-card-reveal flex h-full flex-col gap-4 md:pl-0',
                        index === 1 && 'md:border-l md:border-border/60 md:pl-6'
                      )}
                    >
                      <div
                        className={cn(
                          'inline-flex h-12 w-12 items-center justify-center rounded-2xl text-white',
                          isPassenger ? 'bg-secondary' : 'bg-primary'
                        )}
                      >
                        {isPassenger ? <Smartphone className="h-6 w-6" /> : <ClipboardCheck className="h-6 w-6" />}
                      </div>

                      <div>
                        <h3 className="text-2xl font-black tracking-[-0.03em] text-foreground">{choice.title}</h3>
                        <p className="mt-3 min-h-[5rem] leading-7 text-muted-foreground">{choice.description}</p>
                      </div>

                      <div className="mt-auto space-y-3">
                        <Button
                          asChild
                          className={cn(
                            'h-11 w-full rounded-full font-bold text-white',
                            isPassenger ? 'bg-secondary hover:bg-secondary/90' : 'bg-primary hover:bg-primary/90'
                          )}
                        >
                          <Link href={choice.href}>
                            {choice.ctaLabel}
                            <ArrowRight className="h-4 w-4" />
                          </Link>
                        </Button>
                        <Link
                          href={choice.loginHref}
                          className={cn(
                            'block rounded-full px-3 py-2 text-center text-sm font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-card',
                            isPassenger
                              ? 'text-sky-700 hover:text-sky-900 focus-visible:ring-sky-500 dark:text-sky-300 dark:hover:text-sky-100'
                              : 'text-teal-700 hover:text-teal-900 focus-visible:ring-teal-500 dark:text-teal-300 dark:hover:text-teal-100'
                          )}
                        >
                          {choice.loginLabel}
                        </Link>
                      </div>
                    </article>
                  );
                })}
              </div>
            </div>
          </div>
        </section>

        <section className="px-4 pb-20 pt-6 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-4xl text-center">
            <h2 className="text-balance text-4xl font-black tracking-[-0.04em] text-foreground sm:text-5xl">
              Ready to open the right {BRAND_NAME} app?
            </h2>
            <p className="mx-auto mt-4 max-w-2xl leading-7 text-muted-foreground">
              Choose once, then continue through the onboarding made for your role.
            </p>
            <Button
              asChild
              size="lg"
              className="mt-8 h-12 rounded-full bg-primary px-8 text-base font-bold text-primary-foreground shadow-xl shadow-primary/20 hover:bg-primary/90"
            >
              <Link href={LANDING_PRIMARY_CTA.href}>
                {LANDING_PRIMARY_CTA.label}
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </div>
        </section>
      </main>

      <footer className="border-t border-border/70 bg-card/84 px-4 py-10 sm:px-6 lg:px-8">
        <div className="mx-auto flex max-w-7xl flex-col gap-8 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="font-black tracking-[0.18em] text-foreground">{BRAND_NAME}</p>
            <p className="mt-2 max-w-md text-sm leading-6 text-muted-foreground">
              {PLATFORM_NAME} is a mobile-first product for passenger access, driver onboarding, and tenant-scoped local operations.
            </p>
          </div>
          <div className="flex flex-wrap gap-x-5 gap-y-3 text-sm font-medium text-muted-foreground">
            <Link href="#choose-app" className="hover:text-secondary">
              Choose app
            </Link>
            <Link href="/admin-login" className="hover:text-secondary">
              Admin access
            </Link>
            <Link href="/admin-login" className="hover:text-secondary">
              Superadmin access
            </Link>
            <Link href="/landing" className="hover:text-secondary">
              Landing
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

function SectionIntro({
  label,
  title,
  description,
}: {
  label: string;
  title: string;
  description: string;
}) {
  return (
    <div className="landing-reveal max-w-2xl">
      <p className="text-sm font-black uppercase tracking-[0.18em] text-secondary">{label}</p>
      <h2 className="mt-3 text-4xl font-black tracking-[-0.04em] text-foreground sm:text-5xl">{title}</h2>
      <p className="mt-4 leading-7 text-muted-foreground">{description}</p>
    </div>
  );
}

function ProductMockup() {
  return (
    <div className="landing-reveal landing-float relative mx-auto aspect-[4/5] min-h-[28rem] w-full max-w-[30rem]">
      <div className="absolute inset-8 rounded-[3rem] bg-secondary/18 blur-3xl dark:bg-secondary/22" />
      <div className="absolute bottom-0 right-6 h-40 w-40 rounded-full bg-primary/18 blur-[72px] dark:bg-primary/22" />

      <div className="absolute left-1/2 top-8 w-[72%] -translate-x-1/2 rounded-[2.25rem] border-[10px] border-foreground bg-card p-4 shadow-[0_28px_80px_-34px_rgba(2,6,23,0.58)]">
        <div className="mx-auto mb-5 h-1.5 w-16 rounded-full bg-foreground" />
        <div className="rounded-[1.5rem] bg-muted p-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="h-2.5 w-20 rounded-full bg-foreground" />
              <div className="mt-2 h-2 w-28 rounded-full bg-muted-foreground/35" />
            </div>
            <div className="landing-pulse flex h-10 w-10 items-center justify-center rounded-full bg-primary text-primary-foreground">
              <CheckCircle2 className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-5 rounded-2xl bg-card p-3 shadow-sm">
            <div className="flex items-center gap-3">
              <span className="h-3 w-3 rounded-full bg-primary" />
              <div className="h-2.5 flex-1 rounded-full bg-foreground" />
            </div>
            <div className="ml-1.5 h-10 w-0.5 bg-secondary/25" />
            <div className="flex items-center gap-3">
              <span className="h-3 w-3 rounded-full bg-muted-foreground/28" />
              <div className="h-2.5 w-2/3 rounded-full bg-muted-foreground/28" />
            </div>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3">
            <div className="rounded-2xl bg-card p-3 shadow-sm">
              <div className="h-8 w-8 rounded-xl bg-secondary/14" />
              <div className="mt-3 h-2 w-16 rounded-full bg-foreground" />
              <div className="mt-2 h-2 w-12 rounded-full bg-muted-foreground/28" />
            </div>
            <div className="rounded-2xl bg-foreground p-3 text-background shadow-sm">
              <div className="h-8 w-8 rounded-xl bg-primary/70" />
              <div className="mt-3 h-2 w-16 rounded-full bg-background" />
              <div className="mt-2 h-2 w-10 rounded-full bg-background/35" />
            </div>
          </div>
        </div>
      </div>

      <div className="landing-card-reveal absolute left-0 top-24 w-44 rotate-[-8deg] rounded-[1.5rem] border border-border/70 bg-card p-4 shadow-xl">
        <div className="flex items-center gap-3">
          <LayoutDashboard className="h-5 w-5 text-secondary" />
          <div className="h-2.5 flex-1 rounded-full bg-foreground" />
        </div>
        <div className="mt-4 space-y-2">
          <div className="h-2 rounded-full bg-secondary" />
          <div className="h-2 w-2/3 rounded-full bg-muted-foreground/28" />
        </div>
      </div>

      <div className="landing-card-reveal absolute bottom-16 right-0 w-48 rotate-[7deg] rounded-[1.5rem] border border-border/70 bg-card p-4 shadow-xl">
        <div className="flex items-center justify-between">
          <ClipboardCheck className="h-6 w-6 text-primary" />
          <span className="rounded-full bg-primary/12 px-3 py-1 text-xs font-black text-primary">Ready</span>
        </div>
        <div className="mt-4 h-2.5 rounded-full bg-foreground" />
        <div className="mt-2 h-2.5 w-3/4 rounded-full bg-muted-foreground/28" />
      </div>
    </div>
  );
}
