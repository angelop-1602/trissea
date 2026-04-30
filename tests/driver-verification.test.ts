import test from 'node:test';
import assert from 'node:assert/strict';
import { assertDriverVerified } from '@/lib/booking/auth';
import {
  assertDriverRestrictionTransition,
  assertDriverVerificationTransition,
} from '@/lib/driver-verification';
import {
  getAuthEntryRouteForCurrentUser,
  getAuthEntryRouteForRole,
  getHomeRouteForUser,
} from '@/lib/role-routes';

test('getHomeRouteForUser sends pending drivers to status', () => {
  const route = getHomeRouteForUser({
    role: 'driver',
    isDriverVerified: false,
    isDriverRestricted: false,
  });

  assert.equal(route, '/driver/status');
});

test('getHomeRouteForUser sends restricted drivers to status', () => {
  const route = getHomeRouteForUser({
    role: 'driver',
    isDriverVerified: true,
    isDriverRestricted: true,
  });

  assert.equal(route, '/driver/status');
});

test('getHomeRouteForUser sends verified unrestricted drivers to dashboard', () => {
  const route = getHomeRouteForUser({
    role: 'driver',
    isDriverVerified: true,
    isDriverRestricted: false,
  });

  assert.equal(route, '/driver/tricycle');
});

test('getHomeRouteForUser keeps non-driver role routing unchanged', () => {
  const route = getHomeRouteForUser({
    role: 'admin',
  });

  assert.equal(route, '/admin/tricycle');
});

test('getHomeRouteForUser uses the module hub when multiple transport modules are enabled', () => {
  const route = getHomeRouteForUser(
    {
      role: 'driver',
      isDriverVerified: true,
      isDriverRestricted: false,
    },
    [
      {
        moduleKey: 'tricycle',
        label: 'Tricycle',
        summary: 'Live module',
        stage: 'live',
        isEnabled: true,
        isDefault: true,
        sortOrder: 0,
      },
      {
        moduleKey: 'jeepney',
        label: 'Jeepney',
        summary: 'Prepared module',
        stage: 'planned',
        isEnabled: true,
        isDefault: false,
        sortOrder: 1,
      },
    ]
  );

  assert.equal(route, '/driver/modules');
});

test('getAuthEntryRouteForRole uses role-specific login pages', () => {
  assert.equal(getAuthEntryRouteForRole('passenger'), '/passenger/login');
  assert.equal(getAuthEntryRouteForRole('driver'), '/driver/login');
  assert.equal(getAuthEntryRouteForRole('admin'), '/admin-login');
  assert.equal(getAuthEntryRouteForRole('superadmin'), '/admin-login');
});

test('getAuthEntryRouteForCurrentUser falls back to role entry root without a role', () => {
  assert.equal(getAuthEntryRouteForCurrentUser(), '/');
  assert.equal(getAuthEntryRouteForCurrentUser(null), '/');
});

test('assertDriverVerified throws for pending driver', () => {
  assert.throws(
    () =>
      assertDriverVerified({
        role: 'driver',
        isDriverVerified: false,
        isDriverRestricted: false,
      }),
    (error) =>
      error instanceof Error &&
      'code' in error &&
      'status' in error &&
      error.code === 'DRIVER_NOT_VERIFIED' &&
      error.status === 403
  );
});

test('assertDriverVerified throws for restricted driver', () => {
  assert.throws(
    () =>
      assertDriverVerified({
        role: 'driver',
        isDriverVerified: true,
        isDriverRestricted: true,
      }),
    (error) =>
      error instanceof Error &&
      'code' in error &&
      'status' in error &&
      error.code === 'DRIVER_RESTRICTED' &&
      error.status === 403
  );
});

test('assertDriverVerified allows active verified drivers and non-driver roles', () => {
  assert.doesNotThrow(() =>
    assertDriverVerified({
      role: 'driver',
      isDriverVerified: true,
      isDriverRestricted: false,
    })
  );

  assert.doesNotThrow(() =>
    assertDriverVerified({
      role: 'passenger',
      isDriverVerified: false,
      isDriverRestricted: false,
    })
  );
});

test('assertDriverVerified can allow pending drivers for non-operational identity reads', () => {
  assert.doesNotThrow(() =>
    assertDriverVerified(
      {
        role: 'driver',
        isDriverVerified: false,
        isDriverRestricted: false,
      },
      {
        allowPendingDriver: true,
      }
    )
  );
});

test('assertDriverVerified can allow restricted drivers for non-operational identity reads', () => {
  assert.doesNotThrow(() =>
    assertDriverVerified(
      {
        role: 'driver',
        isDriverVerified: true,
        isDriverRestricted: true,
      },
      {
        allowRestrictedDriver: true,
      }
    )
  );
});

test('assertDriverVerificationTransition allows pending to verified transition', () => {
  assert.doesNotThrow(() =>
    assertDriverVerificationTransition({
      currentIsDriverVerified: false,
      nextIsDriverVerified: true,
    })
  );
});

test('assertDriverVerificationTransition blocks verified to pending transition', () => {
  assert.throws(
    () =>
      assertDriverVerificationTransition({
        currentIsDriverVerified: true,
        nextIsDriverVerified: false,
      }),
    (error) =>
      error instanceof Error &&
      'code' in error &&
      'status' in error &&
      error.code === 'DRIVER_VERIFICATION_LOCKED' &&
      error.status === 409
  );
});

test('assertDriverRestrictionTransition allows restriction with a reason and reinstate actions', () => {
  assert.doesNotThrow(() =>
    assertDriverRestrictionTransition({
      nextIsDriverRestricted: true,
      hasActiveRide: false,
      reason: 'Missed compliance review',
    })
  );

  assert.doesNotThrow(() =>
    assertDriverRestrictionTransition({
      nextIsDriverRestricted: false,
      hasActiveRide: true,
      reason: '',
    })
  );
});

test('assertDriverRestrictionTransition requires a reason when restricting', () => {
  assert.throws(
    () =>
      assertDriverRestrictionTransition({
        nextIsDriverRestricted: true,
        hasActiveRide: false,
        reason: '   ',
      }),
    (error) =>
      error instanceof Error &&
      'code' in error &&
      'status' in error &&
      error.code === 'DRIVER_RESTRICTION_REASON_REQUIRED' &&
      error.status === 400
  );
});

test('assertDriverRestrictionTransition blocks restriction while active ride exists', () => {
  assert.throws(
    () =>
      assertDriverRestrictionTransition({
        nextIsDriverRestricted: true,
        hasActiveRide: true,
        reason: 'Fraud review',
      }),
    (error) =>
      error instanceof Error &&
      'code' in error &&
      'status' in error &&
      error.code === 'DRIVER_HAS_ACTIVE_RIDE' &&
      error.status === 409
  );
});
