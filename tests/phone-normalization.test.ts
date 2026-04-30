import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizePhilippinePhoneInput } from '@/lib/auth/phone';

test('normalizePhilippinePhoneInput converts 09-prefixed values to +63', () => {
  assert.equal(normalizePhilippinePhoneInput('09171234567'), '+639171234567');
});

test('normalizePhilippinePhoneInput adds a missing plus to 63-prefixed values', () => {
  assert.equal(normalizePhilippinePhoneInput('639171234567'), '+639171234567');
});

test('normalizePhilippinePhoneInput adds +63 to local mobile numbers', () => {
  assert.equal(normalizePhilippinePhoneInput('9171234567'), '+639171234567');
});

test('normalizePhilippinePhoneInput keeps existing +63 formatting stable', () => {
  assert.equal(normalizePhilippinePhoneInput('+639171234567'), '+639171234567');
});
