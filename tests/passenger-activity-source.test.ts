import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const source = readFileSync('app/passenger/activity/page.tsx', 'utf8');

test('passenger activity keeps the passenger shell and activity context', () => {
  assert.match(source, /<PassengerAppShell/);
  assert.match(source, /title="Activity"/);
  assert.match(source, /topContext="Activity"/);
  assert.match(source, /headerVariant="compact"/);
  assert.match(source, /headerSurface="minimal"/);
});

test('passenger activity keeps trips and reservations tabs with counts', () => {
  assert.match(source, /<TabsTrigger value="trips"/);
  assert.match(source, />Trips</);
  assert.match(source, /{rides\.length}/);
  assert.match(source, /<TabsTrigger value="reservations"/);
  assert.match(source, />Reservations</);
  assert.match(source, /{reservations\.length}/);
});

test('passenger activity uses URL-backed tab state without scroll reset', () => {
  assert.match(source, /useSearchParams/);
  assert.match(source, /useRouter/);
  assert.match(source, /searchParams\.get\('tab'\) === 'reservations'/);
  assert.match(source, /nextParams\.set\('tab', nextTab\)/);
  assert.match(source, /router\.replace\(`\/passenger\/activity\?\$\{nextParams\.toString\(\)\}`, \{ scroll: false \}\)/);
});

test('passenger activity routes actions to supported passenger surfaces', () => {
  assert.match(source, /href="\/passenger\/on-demand"/);
  assert.match(source, /Book ride/);
  assert.match(source, /Resume trip/);
  assert.match(source, /href="\/passenger\/toda"/);
  assert.match(source, /Open TODA/);
  assert.match(source, /Manage reservation/);
});

test('passenger activity avoids unsupported passenger labels', () => {
  assert.doesNotMatch(source, /wallet/i);
  assert.doesNotMatch(source, /saved places/i);
  assert.doesNotMatch(source, /contact driver/i);
});
