import assert from 'node:assert/strict';
import test from 'node:test';
import { normalizeMapStyleColor } from '@/lib/theme/map-style-color';

test('normalizeMapStyleColor converts oklch to rgb for map paint properties', () => {
  const normalized = normalizeMapStyleColor('oklch(0.672 0.178 140.424)');

  assert.match(normalized, /^rgb\(\d+, \d+, \d+\)$/);
  assert.doesNotMatch(normalized, /^oklch\(/i);
});

test('normalizeMapStyleColor converts oklch alpha values to rgba', () => {
  const normalized = normalizeMapStyleColor('oklch(1 0 0 / 15%)');

  assert.match(normalized, /^rgba\(\d+, \d+, \d+, 0\.15\)$/);
});

test('normalizeMapStyleColor leaves non-oklch values unchanged', () => {
  assert.equal(normalizeMapStyleColor('#22c55e'), '#22c55e');
  assert.equal(normalizeMapStyleColor('rgb(34, 197, 94)'), 'rgb(34, 197, 94)');
});
