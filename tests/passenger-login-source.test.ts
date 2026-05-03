import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const passengerLoginSource = readFileSync('app/(public-auth)/passenger/login/page.tsx', 'utf8');

test('passenger login verifies OTP against passenger accounts only', () => {
  assert.match(passengerLoginSource, /authFlow:\s*'login'/);
  assert.match(passengerLoginSource, /expectedRole:\s*'passenger'/);
});
