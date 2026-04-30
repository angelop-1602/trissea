import test from 'node:test';
import assert from 'node:assert/strict';
import { PASSENGER_PRIMARY_NAV, getPassengerPrimaryNav } from '@/lib/passenger-navigation';

test('passenger primary navigation uses the canonical passenger routes', () => {
  assert.deepEqual(
    PASSENGER_PRIMARY_NAV.map((item) => item.href),
    ['/passenger/home', '/passenger/activity', '/passenger/toda', '/passenger/account']
  );
});

test('passenger primary navigation stays focused on core passenger tasks', () => {
  const labels = PASSENGER_PRIMARY_NAV.map((item) => item.label);

  assert.deepEqual(labels, ['Home', 'Trips', 'Terminals', 'Profile']);
  assert.equal(labels.includes('Wallet'), false);
  assert.equal(PASSENGER_PRIMARY_NAV.some((item) => item.href === '/passenger/todo'), false);
  assert.equal(PASSENGER_PRIMARY_NAV.some((item) => item.href === '/passenger/history'), false);
  assert.equal(PASSENGER_PRIMARY_NAV.some((item) => item.href === '/passenger/wallet'), false);
});

test('passenger navigation can switch its first item to the module hub when multiple modules are enabled', () => {
  const nav = getPassengerPrimaryNav({ hasModuleHub: true });

  assert.equal(nav[0]?.href, '/passenger/modules');
  assert.equal(nav[0]?.label, 'Modules');
  assert.equal(nav.some((item) => item.href === '/passenger/tricycle'), false);
});
