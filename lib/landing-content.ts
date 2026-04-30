import { BRAND_NAME, PLATFORM_NAME } from '@/lib/brand';

export const LANDING_PRIMARY_CTA = {
  label: 'Choose your app',
  href: '#choose-app',
} as const;

export const LANDING_HERO = {
  eyebrow: PLATFORM_NAME,
  headline: `Book local rides faster with ${BRAND_NAME}`,
  subheadline:
    'Choose the Passenger app to book rides, track queue updates, and follow trips live, or the Driver app to go on duty, manage assignments, and stay on top of daily work.',
} as const;

export const LANDING_BENEFITS = [
  {
    title: 'Start from the right flow',
    description: 'Open one clear entry point, then choose the app that matches what you need to do.',
  },
  {
    title: 'Keep booking and queue details close',
    description: 'Book now, reserve ahead, and keep ride, reservation, and activity details within easy reach.',
  },
  {
    title: 'Help drivers stay ready to operate',
    description: 'Go on duty, receive assigned work, and keep trip or terminal context visible from one workspace.',
  },
] as const;

export const LANDING_STEPS = [
  {
    title: 'Choose your app',
    description: 'Pick Passenger if you are booking rides, or Driver if you are preparing to receive and manage assigned work.',
  },
  {
    title: 'Enter the role-specific flow',
    description: 'Use the onboarding and auth path that opens the correct workspace for your day-to-day tasks.',
  },
  {
    title: 'Use the tools made for that role',
    description: 'Passengers follow booking and queue updates. Drivers manage duty state, assignments, and active trips.',
  },
] as const;

export const LANDING_TRUST_ITEMS = [
  {
    title: 'OTP account access',
    description: 'Passenger and driver flows use phone-first account access built for mobile use.',
  },
  {
    title: 'Driver verification',
    description: 'Driver accounts go through admin review before operational access opens.',
  },
  {
    title: 'Tenant-scoped operations',
    description: 'Local workspaces keep admins, drivers, terminals, and reports separated.',
  },
  {
    title: 'Installable PWA',
    description: 'Add a role-specific Passenger or Driver entry point to your home screen.',
  },
] as const;

export const LANDING_APP_CHOICES = [
  {
    role: 'passenger',
    title: 'Passenger app',
    description: 'Book trips, follow live ride status, and keep reservations and recent activity within reach.',
    href: '/passenger',
    loginHref: '/passenger/login',
    ctaLabel: 'Open Passenger app',
    loginLabel: 'Passenger sign in',
  },
  {
    role: 'driver',
    title: 'Driver app',
    description: 'Go on duty, receive assignments, manage active trips, and track terminal work from one workspace.',
    href: '/driver',
    loginHref: '/driver/login',
    ctaLabel: 'Open Driver app',
    loginLabel: 'Driver sign in',
  },
] as const;
