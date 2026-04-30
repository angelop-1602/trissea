import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const source = readFileSync('app/passenger/home/page.tsx', 'utf8');

test('passenger home uses the provided hero assets', () => {
  assert.match(source, /mobile-landing-hero-bg\.png/);
  assert.match(source, /mobile-landing-hero-tricycle\.png/);
});

test('passenger home keeps booking actions on existing routes', () => {
  assert.match(source, /href="\/passenger\/on-demand"/);
  assert.match(source, /Book Tricycle/);
  assert.match(source, /href="\/passenger\/toda"/);
  assert.match(source, /Reserve/);
  assert.match(source, /href="\/passenger\/account"/);
});

test('passenger home includes placeholder ride options', () => {
  assert.match(source, /Regular Ride/);
  assert.match(source, /Shared Ride/);
  assert.match(source, /Special Trip/);
});
