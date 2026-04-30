import test from 'node:test';
import assert from 'node:assert/strict';
import {
  PWA_ROLE_STORAGE_KEY,
  clearStoredPwaRole,
  getPwaRoleFromPathname,
  getPwaRoleFromSearchParams,
  getPwaRoleLandingRoute,
  readStoredPwaRole,
  writeStoredPwaRole,
} from '@/lib/pwa-role';

function createStorage(initial: Record<string, string> = {}) {
  const values = new Map(Object.entries(initial));

  return {
    getItem(key: string) {
      return values.get(key) ?? null;
    },
    setItem(key: string, value: string) {
      values.set(key, value);
    },
    removeItem(key: string) {
      values.delete(key);
    },
  };
}

test('getPwaRoleLandingRoute resolves valid role landing pages', () => {
  assert.equal(getPwaRoleLandingRoute('passenger'), '/passenger');
  assert.equal(getPwaRoleLandingRoute('driver'), '/driver');
});

test('readStoredPwaRole ignores invalid stored values', () => {
  const storage = createStorage({ [PWA_ROLE_STORAGE_KEY]: 'admin' });

  assert.equal(readStoredPwaRole(storage), null);
});

test('getPwaRoleFromPathname resolves role-specific app routes', () => {
  assert.equal(getPwaRoleFromPathname('/passenger'), 'passenger');
  assert.equal(getPwaRoleFromPathname('/passenger/signup'), 'passenger');
  assert.equal(getPwaRoleFromPathname('/driver'), 'driver');
  assert.equal(getPwaRoleFromPathname('/driver/login'), 'driver');
  assert.equal(getPwaRoleFromPathname('/admin'), null);
});

test('getPwaRoleFromSearchParams resolves future app startup parameters', () => {
  assert.equal(getPwaRoleFromSearchParams(new URLSearchParams('app=passenger')), 'passenger');
  assert.equal(getPwaRoleFromSearchParams(new URLSearchParams('role=driver')), 'driver');
  assert.equal(getPwaRoleFromSearchParams(new URLSearchParams('app=admin')), null);
});

test('stored PWA role can be written, overwritten, and cleared safely', () => {
  const storage = createStorage();

  writeStoredPwaRole('passenger', storage);
  assert.equal(readStoredPwaRole(storage), 'passenger');

  writeStoredPwaRole('driver', storage);
  assert.equal(readStoredPwaRole(storage), 'driver');

  clearStoredPwaRole(storage);
  assert.equal(readStoredPwaRole(storage), null);
});
