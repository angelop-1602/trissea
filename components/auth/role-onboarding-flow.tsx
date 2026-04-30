'use client';

import Link from 'next/link';
import { type CSSProperties, useEffect, useState } from 'react';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  type CarouselApi,
} from '@/components/ui/carousel';
import { ReturnNavigation } from '@/components/return-navigation';
import { Button } from '@/components/ui/button';
import { BRAND_NAME } from '@/lib/brand';
import type { RoleOnboardingConfig, RoleOnboardingSlide } from '@/lib/role-onboarding';
import { cn } from '@/lib/utils';

type RoleOnboardingFlowProps = {
  config: RoleOnboardingConfig;
};

type OnboardingArtworkStyle = CSSProperties & {
  '--onboarding-light-image': string;
  '--onboarding-dark-image': string;
};

export const ONBOARDING_SPLASH_DURATION_MS = 2000;

const SPLASH_FADE_MS = 280;
const SPLASH_LOGO_PATH = '/trissea-logo.png';

const ROLE_THEME = {
  passenger: {
    page: 'theme-passenger bg-background text-foreground',
    lower: 'bg-background',
    splash: 'bg-primary text-primary-foreground',
    link: 'text-primary hover:text-primary/80',
    focus: 'focus-visible:ring-primary',
    primary: 'bg-primary text-primary-foreground hover:bg-primary/90',
    progressActive: 'bg-primary dark:bg-primary',
    progressIdle: 'bg-muted',
    mutedText: 'text-muted-foreground',
  },
  driver: {
    page: 'theme-driver bg-background text-foreground',
    lower: 'bg-background',
    splash: 'theme-driver bg-primary text-primary-foreground',
    link: 'text-primary hover:text-primary/80',
    focus: 'focus-visible:ring-primary',
    primary: 'bg-primary text-primary-foreground hover:bg-primary/90',
    progressActive: 'bg-primary dark:bg-primary',
    progressIdle: 'bg-muted',
    mutedText: 'text-muted-foreground',
  },
} as const;

type RoleTheme = (typeof ROLE_THEME)[keyof typeof ROLE_THEME];

export function RoleOnboardingFlow({ config }: RoleOnboardingFlowProps) {
  const [api, setApi] = useState<CarouselApi>();
  const [current, setCurrent] = useState(0);
  const [showSplash, setShowSplash] = useState(true);
  const [splashLeaving, setSplashLeaving] = useState(false);
  const theme = ROLE_THEME[config.role];
  const lastIndex = config.slides.length - 1;
  const isFirst = current === 0;
  const isLast = current === lastIndex;

  useEffect(() => {
    const fadeTimer = window.setTimeout(
      () => setSplashLeaving(true),
      Math.max(0, ONBOARDING_SPLASH_DURATION_MS - SPLASH_FADE_MS)
    );
    const hideTimer = window.setTimeout(
      () => setShowSplash(false),
      ONBOARDING_SPLASH_DURATION_MS
    );

    return () => {
      window.clearTimeout(fadeTimer);
      window.clearTimeout(hideTimer);
    };
  }, []);

  useEffect(() => {
    if (!api) {
      return;
    }

    const updateCurrentSlide = () => setCurrent(api.selectedScrollSnap());
    updateCurrentSlide();
    api.on('select', updateCurrentSlide);
    api.on('reInit', updateCurrentSlide);

    return () => {
      api.off('select', updateCurrentSlide);
      api.off('reInit', updateCurrentSlide);
    };
  }, [api]);

  const jumpTo = (index: number) => {
    const nextIndex = Math.max(0, Math.min(lastIndex, index));
    setCurrent(nextIndex);
    api?.scrollTo(nextIndex);
  };

  if (showSplash) {
    return (
      <OnboardingSplash
        role={config.role}
        leaving={splashLeaving}
      />
    );
  }

  return (
    <main className={cn('relative min-h-[100svh] overflow-hidden transition-colors', theme.page)}>
      <div className="relative min-h-[100svh] w-full">
        <header className="absolute inset-x-5 top-5 z-20 flex items-start justify-between sm:inset-x-7 lg:inset-x-10">
          <ReturnNavigation
            fallbackHref={config.final.secondaryHref}
            className={cn(
              'h-10 w-10 shrink-0 rounded-full border border-current/12 bg-white/72 text-current shadow-[0_16px_38px_-26px_rgba(15,23,42,0.45)] backdrop-blur-xl hover:bg-white/82 dark:bg-black/18 dark:hover:bg-black/28'
            )}
          />

          <Link
            href={config.final.primaryHref}
            className={cn(
              'shrink-0 rounded-full px-2 py-1 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent',
              theme.link,
              theme.focus
            )}
          >
            Skip
          </Link>
        </header>

        <Carousel
          className="min-h-[100svh] [&_[data-slot=carousel-content]]:min-h-[100svh]"
          setApi={setApi}
          opts={{ align: 'start', containScroll: 'trimSnaps' }}
        >
          <CarouselContent className="-ml-0 min-h-[100svh]">
            {config.slides.map((slide, index) => (
              <CarouselItem key={slide.title} className="min-h-[100svh] pl-0">
                <OnboardingFullPageSlide
                  slide={slide}
                  active={index === current}
                  theme={theme}
                />
              </CarouselItem>
            ))}
          </CarouselContent>
        </Carousel>

        <footer className="absolute inset-x-5 bottom-[max(1.25rem,env(safe-area-inset-bottom))] z-20 sm:inset-x-7 lg:inset-x-10">
          <div className="flex items-center justify-center gap-2" aria-label="Onboarding progress">
            {config.slides.map((slide, progressIndex) => (
              <button
                key={slide.title}
                type="button"
                onClick={() => jumpTo(progressIndex)}
                className={cn(
                  'h-2 rounded-full transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent',
                  progressIndex === current ? `w-8 ${theme.progressActive}` : `w-2 ${theme.progressIdle}`,
                  theme.focus
                )}
                aria-label={`Go to slide ${progressIndex + 1}`}
                aria-current={progressIndex === current ? 'step' : undefined}
              />
            ))}
          </div>

          <div className={cn('mt-5 flex items-center gap-4', isFirst ? 'justify-end' : 'justify-between')}>
            {!isFirst ? (
              <button
                type="button"
                onClick={() => jumpTo(current - 1)}
                className={cn(
                  'inline-flex min-w-[5rem] items-center gap-2 text-sm font-semibold underline-offset-4 transition-colors hover:underline',
                  theme.link
                )}
              >
                <ArrowLeft className="h-4 w-4" />
                Back
              </button>
            ) : null}

            {isLast ? (
              <Button asChild className={cn('h-12 rounded-full px-7 text-base font-semibold', theme.primary)}>
                <Link href={config.final.primaryHref}>{config.final.primaryLabel}</Link>
              </Button>
            ) : (
              <button
                type="button"
                onClick={() => jumpTo(current + 1)}
                className={cn(
                  'inline-flex min-w-[5rem] items-center justify-end gap-2 text-sm font-semibold underline-offset-4 transition-colors hover:underline',
                  theme.link
                )}
              >
                Next
                <ArrowRight className="h-4 w-4" />
              </button>
            )}
          </div>

          <p className={cn('mt-4 text-center text-sm', theme.mutedText)}>
            Already have an account?{' '}
            <Link
              href={config.final.secondaryHref}
              className={cn(
                'font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent',
                theme.link,
                theme.focus
              )}
            >
              {config.final.secondaryLabel}
            </Link>
          </p>
        </footer>
      </div>
    </main>
  );
}

function OnboardingSplash({
  role,
  leaving,
}: {
  role: RoleOnboardingConfig['role'];
  leaving: boolean;
}) {
  const theme = ROLE_THEME[role];

  return (
    <main
      aria-label={`${BRAND_NAME} onboarding is loading`}
      aria-busy="true"
      className={cn('relative grid min-h-[100svh] place-items-center overflow-hidden text-white transition-colors', theme.splash)}
    >
      <div
        className={cn(
          'flex flex-col items-center justify-center transition-all duration-300 ease-out',
          leaving ? 'scale-[1.03] opacity-0' : 'scale-100 opacity-100'
        )}
      >
        <img
          src={SPLASH_LOGO_PATH}
          alt={`${BRAND_NAME} logo`}
          className="h-28 w-28 rounded-3xl bg-white/95 object-contain p-2 shadow-lg sm:h-32 sm:w-32"
        />
      </div>
    </main>
  );
}

function OnboardingFullPageSlide({
  slide,
  active,
  theme,
}: {
  slide: RoleOnboardingSlide;
  active: boolean;
  theme: RoleTheme;
}) {
  const artworkStyle: OnboardingArtworkStyle = {
    '--onboarding-light-image': `url("${slide.image.lightSrc}")`,
    '--onboarding-dark-image': `url("${slide.image.darkSrc}")`,
  };

  return (
    <article
      aria-current={active ? 'step' : undefined}
      className="grid min-h-[100svh] grid-rows-[minmax(0,1fr)_auto] pb-36 lg:grid-cols-[minmax(0,1.12fr)_minmax(26rem,0.88fr)] lg:grid-rows-1 lg:pb-0"
    >
      <div className="relative min-h-[62svh] overflow-hidden lg:min-h-[100svh]">
        <div
          role="img"
          aria-label={slide.image.alt}
          style={artworkStyle}
          className="absolute inset-0 bg-[image:var(--onboarding-light-image)] bg-cover bg-[position:center_15%] bg-no-repeat dark:bg-[image:var(--onboarding-dark-image)] lg:bg-[position:center_18%]"
        />
        <div className={cn('pointer-events-none absolute inset-x-0 bottom-[-1px] h-10 rounded-t-[70%] lg:hidden', theme.lower)} />
      </div>

      <section className={cn('relative z-10 px-6 pb-6 pt-4 text-center sm:px-10 lg:flex lg:min-h-[100svh] lg:flex-col lg:justify-center lg:px-12 lg:pb-32 lg:pt-28 lg:text-left', theme.lower)}>
        <h1 className="mx-auto max-w-[28rem] text-balance text-[clamp(1.72rem,7.2vw,3.9rem)] font-black leading-[0.98] tracking-[-0.025em] text-current lg:mx-0 lg:max-w-[36rem]">
          {slide.title}
        </h1>
        <p className="mx-auto mt-3 max-w-[22rem] text-pretty text-sm leading-6 text-current/76 sm:text-base lg:mx-0 lg:max-w-[28rem]">
          {slide.description}
        </p>
      </section>
    </article>
  );
}
