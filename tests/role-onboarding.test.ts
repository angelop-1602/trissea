import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ROLE_ONBOARDING } from '@/lib/role-onboarding';

const EXPECTED_PASSENGER_SLIDES = [
  {
    title: 'Book Your Ride Easily',
    description: 'Request a ride and get started in just a few taps.',
  },
  {
    title: 'Choose Your Pickup Point',
    description: 'Set your pickup location quickly and accurately.',
  },
  {
    title: 'Set Your Destination',
    description: 'Pick where you want to go with a simple, smooth flow.',
  },
  {
    title: 'Confirm in Seconds',
    description: 'Review your trip details and confirm with ease.',
  },
  {
    title: 'Track Your Booking',
    description: 'Stay updated as your booking progresses.',
  },
  {
    title: 'Ride with Confidence',
    description: 'Enjoy a smooth and secure booking experience every time.',
  },
];

const EXPECTED_DRIVER_SLIDES = [
  {
    title: 'Manage Trips with Ease',
    description: 'Handle bookings and trip details from one simple app.',
  },
  {
    title: 'Accept Booking Requests',
    description: 'Receive and respond to trip requests with ease.',
  },
  {
    title: 'View Trip Details Clearly',
    description: 'See pickup points, destinations, and trip flow at a glance.',
  },
  {
    title: 'Stay Organized on Every Trip',
    description: 'Keep track of active bookings and ride status smoothly.',
  },
  {
    title: 'Drive with Confidence',
    description: 'Use smart tools that help you stay ready and in control.',
  },
  {
    title: 'Grow with Flexible Driving',
    description: 'Take trips on your schedule and manage them smoothly.',
  },
];

test('passenger onboarding has six slides and passenger auth routes', () => {
  const config = ROLE_ONBOARDING.passenger;

  assert.equal(config.slides.length, 6);
  assert.equal(config.final.primaryHref, '/passenger/signup');
  assert.equal(config.final.secondaryHref, '/passenger/login');
  assert.equal(config.switchHref, '/driver');
});

test('driver onboarding has six slides and driver auth routes', () => {
  const config = ROLE_ONBOARDING.driver;

  assert.equal(config.slides.length, 6);
  assert.equal(config.final.primaryHref, '/driver/signup');
  assert.equal(config.final.secondaryHref, '/driver/login');
  assert.equal(config.switchHref, '/passenger');
});

test('passenger onboarding uses the approved slide copy in order', () => {
  assert.deepEqual(
    ROLE_ONBOARDING.passenger.slides.map(({ title, description }) => ({ title, description })),
    EXPECTED_PASSENGER_SLIDES
  );
});

test('driver onboarding uses the approved slide copy in order', () => {
  assert.deepEqual(
    ROLE_ONBOARDING.driver.slides.map(({ title, description }) => ({ title, description })),
    EXPECTED_DRIVER_SLIDES
  );
});

test('every onboarding slide has required image metadata', () => {
  for (const config of Object.values(ROLE_ONBOARDING)) {
    for (const slide of config.slides) {
      assert.ok(slide.title.trim().length > 0);
      assert.ok(slide.description.trim().length > 0);
      assert.ok(slide.image.lightSrc.startsWith('/'));
      assert.ok(slide.image.darkSrc.startsWith('/'));
      assert.ok(slide.image.alt.includes(slide.title));
    }
  }
});

test('every onboarding slide references existing light and dark assets', () => {
  for (const config of Object.values(ROLE_ONBOARDING)) {
    for (const slide of config.slides) {
      const lightPath = join(process.cwd(), 'public', slide.image.lightSrc.slice(1));
      const darkPath = join(process.cwd(), 'public', slide.image.darkSrc.slice(1));

      assert.equal(existsSync(lightPath), true, `${slide.image.lightSrc} should exist`);
      assert.equal(existsSync(darkPath), true, `${slide.image.darkSrc} should exist`);
    }
  }
});

test('onboarding component no longer contains board copy or numbered step pills', () => {
  const source = readFileSync(
    join(process.cwd(), 'components', 'auth', 'role-onboarding-flow.tsx'),
    'utf8'
  );

  assert.equal(source.includes('Four simple screens'), false);
  assert.equal(source.includes('4-step preview'), false);
  assert.equal(source.includes('Booking made simple from first step to final update'), false);
  assert.equal(source.includes('A cleaner onboarding flow'), false);
  assert.equal(source.includes('padStart(2'), false);
});

test('onboarding splash duration remains the agreed loading prelude', () => {
  const source = readFileSync(
    join(process.cwd(), 'components', 'auth', 'role-onboarding-flow.tsx'),
    'utf8'
  );

  assert.match(source, /ONBOARDING_SPLASH_DURATION_MS\s*=\s*2000/);
});
