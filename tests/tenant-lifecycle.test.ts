import assert from 'node:assert/strict';
import test from 'node:test';
import { BookingError } from '@/lib/booking/errors';
import {
  assertTenantIsAccessible,
  buildTenantSuspensionMessage,
  isTenantSuspendedForUser,
} from '@/lib/tenant-lifecycle';
import { getTenantSuspendedRoute } from '@/lib/role-routes';

const suspendedTenant = {
  id: 'tenant-1',
  name: 'Tuguegarao City',
  status: 'suspended' as const,
  suspendedAt: new Date('2026-04-20T00:00:00.000Z'),
  suspensionReason: 'Tenant billing review is in progress.',
};

test('isTenantSuspendedForUser only blocks tenant-scoped non-superadmin users', () => {
  assert.equal(
    isTenantSuspendedForUser({ role: 'admin', tenantId: 'tenant-1' }, suspendedTenant),
    true
  );
  assert.equal(
    isTenantSuspendedForUser({ role: 'driver', tenantId: 'tenant-1' }, suspendedTenant),
    true
  );
  assert.equal(
    isTenantSuspendedForUser({ role: 'passenger', tenantId: 'tenant-1' }, suspendedTenant),
    true
  );
  assert.equal(
    isTenantSuspendedForUser({ role: 'superadmin', tenantId: 'tenant-1' }, suspendedTenant),
    false
  );
  assert.equal(
    isTenantSuspendedForUser({ role: 'admin', tenantId: null }, suspendedTenant),
    false
  );
});

test('buildTenantSuspensionMessage prefers explicit suspension reason', () => {
  assert.equal(buildTenantSuspensionMessage(suspendedTenant), suspendedTenant.suspensionReason);
  assert.equal(
    buildTenantSuspensionMessage({
      name: 'Tenant Workspace',
      suspensionReason: '   ',
    }),
    'Tenant Workspace is currently suspended by platform support.'
  );
});

test('assertTenantIsAccessible throws TENANT_SUSPENDED for blocked tenant users', () => {
  assert.throws(
    () => assertTenantIsAccessible({ role: 'admin', tenantId: 'tenant-1' }, suspendedTenant),
    (error) =>
      error instanceof BookingError &&
      error.code === 'TENANT_SUSPENDED' &&
      error.status === 403 &&
      error.message === suspendedTenant.suspensionReason
  );
});

test('assertTenantIsAccessible allows active tenants, missing tenants, and superadmins', () => {
  assert.doesNotThrow(() =>
    assertTenantIsAccessible(
      { role: 'admin', tenantId: 'tenant-1' },
      {
        ...suspendedTenant,
        status: 'active',
        suspensionReason: null,
      }
    )
  );
  assert.doesNotThrow(() =>
    assertTenantIsAccessible({ role: 'superadmin', tenantId: 'tenant-1' }, suspendedTenant)
  );
  assert.doesNotThrow(() => assertTenantIsAccessible({ role: 'admin', tenantId: 'tenant-1' }, null));
});

test('getTenantSuspendedRoute preserves role and message in the query string', () => {
  assert.equal(getTenantSuspendedRoute(), '/tenant-suspended');
  assert.equal(
    getTenantSuspendedRoute({
      role: 'driver',
      message: 'Tenant is suspended',
    }),
    '/tenant-suspended?role=driver&message=Tenant+is+suspended'
  );
});
