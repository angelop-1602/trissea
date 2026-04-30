import test from 'node:test';
import assert from 'node:assert/strict';
import {
  filterAdminDriversBySource,
  getAdminDriverListHref,
  matchesAdminDriverSearch,
  normalizeAdminDriverListSource,
} from '@/lib/admin-driver-management';

const drivers = [
  {
    id: 'driver-verified-online',
    name: 'Alex Ramos',
    email: 'alex@example.com',
    phone: '+639171111111',
    isDriverVerified: true,
    isDriverRestricted: false,
    DriverPresence: {
      isOnline: true,
      onlineSinceAt: null,
      lastHeartbeatAt: null,
    },
  },
  {
    id: 'driver-verified-restricted',
    name: 'Bianca Cruz',
    email: 'bianca@example.com',
    phone: '+639172222222',
    isDriverVerified: true,
    isDriverRestricted: true,
    DriverPresence: {
      isOnline: false,
      onlineSinceAt: null,
      lastHeartbeatAt: null,
    },
  },
  {
    id: 'driver-pending',
    name: 'Carlos Dela Vega',
    email: 'carlos@example.com',
    phone: '+639173333333',
    isDriverVerified: false,
    isDriverRestricted: false,
    DriverPresence: null,
  },
];

test('normalizeAdminDriverListSource defaults to verified drivers list', () => {
  assert.equal(normalizeAdminDriverListSource(undefined), 'verified');
  assert.equal(normalizeAdminDriverListSource('drivers'), 'verified');
  assert.equal(normalizeAdminDriverListSource('verified'), 'verified');
  assert.equal(normalizeAdminDriverListSource('something-else'), 'verified');
});

test('normalizeAdminDriverListSource preserves sub-list source and href mapping', () => {
  assert.equal(normalizeAdminDriverListSource('unverified'), 'unverified');
  assert.equal(normalizeAdminDriverListSource('restricted'), 'restricted');
  assert.equal(getAdminDriverListHref('verified'), '/admin/drivers');
  assert.equal(getAdminDriverListHref('unverified'), '/admin/drivers/unverified');
  assert.equal(getAdminDriverListHref('restricted'), '/admin/drivers/restricted');
});

test('filterAdminDriversBySource splits verified, restricted, and pending drivers', () => {
  assert.deepEqual(
    filterAdminDriversBySource(drivers, 'verified').map((driver) => driver.id),
    ['driver-verified-online']
  );

  assert.deepEqual(
    filterAdminDriversBySource(drivers, 'unverified').map((driver) => driver.id),
    ['driver-pending']
  );

  assert.deepEqual(
    filterAdminDriversBySource(drivers, 'restricted').map((driver) => driver.id),
    ['driver-verified-restricted']
  );
});

test('matchesAdminDriverSearch supports status-aware queries', () => {
  assert.equal(matchesAdminDriverSearch(drivers[0], 'online'), true);
  assert.equal(matchesAdminDriverSearch(drivers[1], 'restricted'), true);
  assert.equal(matchesAdminDriverSearch(drivers[2], 'pending'), true);
  assert.equal(matchesAdminDriverSearch(drivers[0], 'carlos'), false);
});
