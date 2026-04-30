import { DRIVER_APP_NAME, PASSENGER_APP_NAME } from '@/lib/brand';

export type RoleOnboardingRole = 'passenger' | 'driver';

export type OnboardingSlideImage = {
  lightSrc: string;
  darkSrc: string;
  alt: string;
};

export type RoleOnboardingSlide = {
  title: string;
  description: string;
  image: OnboardingSlideImage;
};

export type RoleOnboardingConfig = {
  role: RoleOnboardingRole;
  appName: string;
  eyebrow: string;
  switchLabel: string;
  switchHref: string;
  final: {
    primaryLabel: string;
    primaryHref: string;
    secondaryLabel: string;
    secondaryHref: string;
    switchPrompt: string;
  };
  slides: RoleOnboardingSlide[];
};

function onboardingImage(
  role: RoleOnboardingRole,
  index: number,
  title: string
): OnboardingSlideImage {
  const folder = role === 'passenger' ? 'Passenger' : 'Driver';
  const prefix = role === 'passenger' ? 'passenger' : 'driver';
  const number = String(index).padStart(2, '0');

  return {
    lightSrc: `/${folder}/${prefix}-onboarding-light-${number}.png`,
    darkSrc: `/${folder}/${prefix}-onboarding-dark-${number}.png`,
    alt: `${role === 'passenger' ? PASSENGER_APP_NAME : DRIVER_APP_NAME} onboarding artwork for ${title}.`,
  };
}

export const ROLE_ONBOARDING: Record<RoleOnboardingRole, RoleOnboardingConfig> = {
  passenger: {
    role: 'passenger',
    appName: PASSENGER_APP_NAME,
    eyebrow: 'Passenger app',
    switchLabel: 'I am a driver',
    switchHref: '/driver',
    final: {
      primaryLabel: 'Get started',
      primaryHref: '/passenger/signup',
      secondaryLabel: 'Sign in',
      secondaryHref: '/passenger/login',
      switchPrompt: 'Need the driver app?',
    },
    slides: [
      {
        title: 'Book Your Ride Easily',
        description: 'Request a ride and get started in just a few taps.',
        image: onboardingImage('passenger', 1, 'Book Your Ride Easily'),
      },
      {
        title: 'Choose Your Pickup Point',
        description: 'Set your pickup location quickly and accurately.',
        image: onboardingImage('passenger', 2, 'Choose Your Pickup Point'),
      },
      {
        title: 'Set Your Destination',
        description: 'Pick where you want to go with a simple, smooth flow.',
        image: onboardingImage('passenger', 3, 'Set Your Destination'),
      },
      {
        title: 'Confirm in Seconds',
        description: 'Review your trip details and confirm with ease.',
        image: onboardingImage('passenger', 4, 'Confirm in Seconds'),
      },
      {
        title: 'Track Your Booking',
        description: 'Stay updated as your booking progresses.',
        image: onboardingImage('passenger', 5, 'Track Your Booking'),
      },
      {
        title: 'Ride with Confidence',
        description: 'Enjoy a smooth and secure booking experience every time.',
        image: onboardingImage('passenger', 6, 'Ride with Confidence'),
      },
    ],
  },
  driver: {
    role: 'driver',
    appName: DRIVER_APP_NAME,
    eyebrow: 'Driver app',
    switchLabel: 'I am a passenger',
    switchHref: '/passenger',
    final: {
      primaryLabel: 'Get started',
      primaryHref: '/driver/signup',
      secondaryLabel: 'Sign in',
      secondaryHref: '/driver/login',
      switchPrompt: 'Need the passenger app?',
    },
    slides: [
      {
        title: 'Manage Trips with Ease',
        description: 'Handle bookings and trip details from one simple app.',
        image: onboardingImage('driver', 1, 'Manage Trips with Ease'),
      },
      {
        title: 'Accept Booking Requests',
        description: 'Receive and respond to trip requests with ease.',
        image: onboardingImage('driver', 2, 'Accept Booking Requests'),
      },
      {
        title: 'View Trip Details Clearly',
        description: 'See pickup points, destinations, and trip flow at a glance.',
        image: onboardingImage('driver', 3, 'View Trip Details Clearly'),
      },
      {
        title: 'Stay Organized on Every Trip',
        description: 'Keep track of active bookings and ride status smoothly.',
        image: onboardingImage('driver', 4, 'Stay Organized on Every Trip'),
      },
      {
        title: 'Drive with Confidence',
        description: 'Use smart tools that help you stay ready and in control.',
        image: onboardingImage('driver', 5, 'Drive with Confidence'),
      },
      {
        title: 'Grow with Flexible Driving',
        description: 'Take trips on your schedule and manage them smoothly.',
        image: onboardingImage('driver', 6, 'Grow with Flexible Driving'),
      },
    ],
  },
};
