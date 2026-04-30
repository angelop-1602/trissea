import assert from 'node:assert/strict';
import test from 'node:test';
import {
  LANDING_APP_CHOICES,
  LANDING_HERO,
  LANDING_PRIMARY_CTA,
  LANDING_TRUST_ITEMS,
} from '@/lib/landing-content';

test('landing primary CTA points to the app choice section', () => {
  assert.equal(LANDING_PRIMARY_CTA.label, 'Choose your app');
  assert.equal(LANDING_PRIMARY_CTA.href, '#choose-app');
});

test('landing hero uses the agreed primary copy', () => {
  assert.equal(LANDING_HERO.headline, 'TRISSEA');
  assert.equal(
    LANDING_HERO.subheadline,
    'Book tricycle rides in Tuguegarao City, follow queue updates, and help drivers stay ready for daily TODA operations.'
  );
});

test('landing app choices route to role onboarding pages', () => {
  const passenger = LANDING_APP_CHOICES.find((choice) => choice.role === 'passenger');
  const driver = LANDING_APP_CHOICES.find((choice) => choice.role === 'driver');

  assert.equal(passenger?.href, '/passenger');
  assert.equal(passenger?.loginHref, '/passenger/login');
  assert.equal(driver?.href, '/driver');
  assert.equal(driver?.loginHref, '/driver/login');
});

test('landing trust copy avoids fabricated metric claims', () => {
  for (const item of LANDING_TRUST_ITEMS) {
    assert.equal(/\b\d+(?:[,.]\d+)?\s*(?:%|users?|rides?|drivers?|stars?|x)\b/i.test(item.description), false);
  }
});

test('landing app choices describe actual passenger and driver workflows', () => {
  const passenger = LANDING_APP_CHOICES.find((choice) => choice.role === 'passenger');
  const driver = LANDING_APP_CHOICES.find((choice) => choice.role === 'driver');

  assert.match(passenger?.description ?? '', /live ride status|reservations|activity/i);
  assert.match(driver?.description ?? '', /go on duty|assignments|active trips|terminal work/i);
});
