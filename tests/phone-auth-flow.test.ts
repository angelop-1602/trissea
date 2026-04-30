import test from 'node:test';
import assert from 'node:assert/strict';
import { assertPhoneLoginOnlyAccess } from '@/lib/auth/phone-auth-flow';

test('phone login-only flow requires an existing driver account', () => {
  assert.throws(
    () =>
      assertPhoneLoginOnlyAccess({
        flow: 'login',
        expectedRole: 'driver',
        existingRole: null,
      }),
    (error) =>
      error instanceof Error &&
      'code' in error &&
      'status' in error &&
      error.code === 'PROFILE_NOT_FOUND' &&
      error.status === 404
  );
});

test('phone login-only flow blocks role mismatch for driver login', () => {
  assert.throws(
    () =>
      assertPhoneLoginOnlyAccess({
        flow: 'login',
        expectedRole: 'driver',
        existingRole: 'passenger',
      }),
    (error) =>
      error instanceof Error &&
      'code' in error &&
      'status' in error &&
      error.code === 'ROLE_MISMATCH' &&
      error.status === 409
  );
});

test('phone login-only flow allows an existing matching driver account', () => {
  assert.doesNotThrow(() =>
    assertPhoneLoginOnlyAccess({
      flow: 'login',
      expectedRole: 'driver',
      existingRole: 'driver',
    })
  );
});

test('signup flow stays permissive for brand-new account creation', () => {
  assert.doesNotThrow(() =>
    assertPhoneLoginOnlyAccess({
      flow: 'signup',
      expectedRole: 'driver',
      existingRole: null,
    })
  );
});
