import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const passengerShellSource = readFileSync('components/passenger/passenger-app-shell.tsx', 'utf8');

test('passenger shell reserves space for the raised bottom navigation', () => {
  assert.match(passengerShellSource, /calc\(8rem \+ env\(safe-area-inset-bottom\)\)/);
});
