import test from 'node:test';
import assert from 'node:assert/strict';
import { PASSENGER_PRIMARY_NAV, getPassengerPrimaryNav } from '@/lib/passenger-navigation';

test('passenger primary navigation uses the canonical passenger routes', () => {
  assert.deepEqual(
    PASSENGER_PRIMARY_NAV.map((item) => item.href),
    ['/passenger/home', '/passenger/scan', '/passenger/on-demand', '/passenger/activity', '/passenger/toda']
  );
});

test('passenger primary navigation stays focused on core passenger tasks', () => {
  const labels = PASSENGER_PRIMARY_NAV.map((item) => item.label);

  assert.deepEqual(labels, ['Home', 'Scan', 'Book', 'Activity', 'TODA']);
  assert.equal(labels.includes('Wallet'), false);
  assert.equal(labels.includes('Profile'), false);
  assert.equal(PASSENGER_PRIMARY_NAV.some((item) => item.href === '/passenger/todo'), false);
  assert.equal(PASSENGER_PRIMARY_NAV.some((item) => item.href === '/passenger/history'), false);
  assert.equal(PASSENGER_PRIMARY_NAV.some((item) => item.href === '/passenger/account'), false);
  assert.equal(PASSENGER_PRIMARY_NAV.some((item) => item.href === '/passenger/wallet'), false);
});

test('passenger navigation uses Book as the raised center action', () => {
  const primaryAction = PASSENGER_PRIMARY_NAV.find((item) => item.isPrimaryAction);

  assert.equal(primaryAction?.href, '/passenger/on-demand');
  assert.equal(primaryAction?.label, 'Book');
  assert.equal(PASSENGER_PRIMARY_NAV.indexOf(primaryAction!), 2);
});

test('passenger navigation can switch its first item to the module hub when multiple modules are enabled', () => {
  const nav = getPassengerPrimaryNav({ hasModuleHub: true });

  assert.equal(nav[0]?.href, '/passenger/modules');
  assert.equal(nav[0]?.label, 'Modules');
  assert.equal(nav.some((item) => item.href === '/passenger/tricycle'), false);
});
