import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const passengerOnDemandSource = readFileSync('app/passenger/on-demand/page.tsx', 'utf8');
const driverActiveTripSource = readFileSync('app/driver/active-trip/page.tsx', 'utf8');
const activeBookingSheetSource = readFileSync('components/booking/active-booking-sheet.tsx', 'utf8');

test('passenger active ride shows assigned driver details', () => {
  assert.match(passengerOnDemandSource, /function ActiveDriverProfile/);
  assert.match(passengerOnDemandSource, /function ActiveDriverCompactProfile/);
  assert.match(passengerOnDemandSource, /ride\.driver\.name/);
  assert.match(passengerOnDemandSource, /Your driver/);
  assert.match(passengerOnDemandSource, /ride\.driver\.rating/);
  assert.match(passengerOnDemandSource, /ActiveBookingPersonCard/);
  assert.match(passengerOnDemandSource, /ActiveBookingCompactPersonRow/);
});

test('driver active trip shows passenger profile details', () => {
  assert.match(driverActiveTripSource, /function ActivePassengerProfile/);
  assert.match(driverActiveTripSource, /function ActivePassengerCompactProfile/);
  assert.match(driverActiveTripSource, /ride\.passenger\.name/);
  assert.match(driverActiveTripSource, /Passenger/);
  assert.match(driverActiveTripSource, /getPassengerProfileHint/);
  assert.match(driverActiveTripSource, /ActiveBookingPersonCard/);
  assert.match(driverActiveTripSource, /ActiveBookingCompactPersonRow/);
});

test('passenger and driver active sheets use the shared booking sheet system', () => {
  for (const source of [passengerOnDemandSource, driverActiveTripSource]) {
    assert.match(source, /ActiveBookingSheetShell/);
    assert.match(source, /ActiveBookingSheetBody/);
    assert.match(source, /ActiveBookingSheetFooter/);
    assert.match(source, /ACTIVE_BOOKING_SHEET_COLLAPSED_HEIGHT/);
    assert.match(source, /ACTIVE_BOOKING_SHEET_EXPANDED_MAX_HEIGHT/);
  }

  assert.match(activeBookingSheetSource, /ACTIVE_BOOKING_SHEET_FOOTER_PADDING/);
  assert.match(activeBookingSheetSource, /ActiveBookingRouteSummary/);
  assert.match(activeBookingSheetSource, /ActiveBookingHero/);
});

test('driver active trip keeps workflow controls inside the shared sheet rhythm', () => {
  assert.match(driverActiveTripSource, /function getDriverHeroTitle/);
  assert.match(driverActiveTripSource, /ActiveBookingHero/);
  assert.match(driverActiveTripSource, /ActiveBookingRouteSummary/);
  assert.match(driverActiveTripSource, /LIVE_STEPS\.map/);
});
