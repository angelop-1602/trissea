import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const source = readFileSync('app/passenger/on-demand/page.tsx', 'utf8');

test('passenger on-demand keeps the immersive passenger shell', () => {
  assert.match(source, /<PassengerAppShell/);
  assert.match(source, /showHeader=\{false\}/);
  assert.match(source, /preserveBottomNavSpace=\{false\}/);
  assert.match(source, /contentClassName="!max-w-full !space-y-0 !px-0 !py-0"/);
});

test('passenger on-demand destination search uses pickup-first location bias', () => {
  assert.match(source, /const dropoffSearchBias = useMemo/);
  assert.match(source, /pickup \?\? userLocation/);
  assert.match(source, /latitude', bias\.latitude\.toString\(\)/);
  assert.match(source, /longitude', bias\.longitude\.toString\(\)/);
  assert.match(source, /searchAddress\(query, dropoffSearchBias\)/);
});

test('passenger on-demand pickup search uses real location bias without a fixed LGU fallback', () => {
  assert.doesNotMatch(source, /fallbackSearchBias/);
  assert.match(source, /const pickupSearchBias = useMemo/);
  assert.match(source, /\(\) => userLocation/);
  assert.match(source, /searchAddress\(query, pickupSearchBias\)/);
});

test('passenger on-demand does not draw direct fallback routes when road routing fails', () => {
  assert.match(source, /const displayedActiveRideRouteCoordinates = activeRideRouteCoordinates/);
  assert.doesNotMatch(source, /setActiveRideRouteCoordinates\(activeRideDirectRouteCoordinates\)/);
});

test('passenger on-demand uses a focused booking console sheet', () => {
  assert.match(source, /Booking status/);
  assert.match(source, /Route ready/);
  assert.match(source, /Assigned Terminal/);
  assert.match(source, /Queue/);
  assert.match(source, /ETA/);
  assert.match(source, /Available/);
  assert.match(source, /Regular/);
  assert.match(source, /Shared/);
  assert.match(source, /Special/);
  assert.match(source, /Book Tricycle/);
});

test('passenger on-demand supports an expanded and collapsed draft sheet', () => {
  assert.match(source, /DRAFT_BOOKING_SHEET_COLLAPSED_HEIGHT/);
  assert.match(source, /const isSheetOpen = sheetExpanded/);
  assert.match(source, /Collapse booking sheet/);
  assert.match(source, /Expand booking sheet/);
  assert.match(source, /aria-label="Expand booking sheet"/);
  assert.match(source, /collapsedRouteSummary/);
});

test('passenger on-demand moves route clearing to the search card', () => {
  assert.match(source, /Clear route/);
  assert.doesNotMatch(source, />\s*Reset\s*</);
  assert.match(source, /onClick=\{resetPins\}/);
});

test('passenger on-demand keeps only the right-side locate control', () => {
  assert.doesNotMatch(source, /Center map on your location/);
  assert.match(source, /Find my location/);
  assert.match(source, /Toggle map layer/);
  assert.match(source, /Toggle fullscreen map/);
});

test('passenger on-demand keeps unsupported passenger shortcuts out of the booking flow', () => {
  assert.doesNotMatch(source, /Wallet/);
  assert.doesNotMatch(source, /Saved places/i);
  assert.doesNotMatch(source, /Contact driver/i);
});
