import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const bottomNavSource = readFileSync('components/bottom-nav.tsx', 'utf8');

test('bottom navigation uses one active indicator without the extra dot badge', () => {
  assert.match(bottomNavSource, /aria-current=\{isActive \? 'page' : undefined\}/);
  assert.doesNotMatch(bottomNavSource, /import\s+\{[^}]*\bDot\b[^}]*\}\s+from 'lucide-react'/);
  assert.doesNotMatch(bottomNavSource, /<Dot\b/);
});

test('bottom navigation lays out whatever primary items are configured', () => {
  assert.match(bottomNavSource, /gridTemplateColumns/);
  assert.doesNotMatch(bottomNavSource, /grid-cols-4/);
});

test('bottom navigation is full width with a raised center action style', () => {
  assert.match(bottomNavSource, /fixed inset-x-0 bottom-0/);
  assert.match(bottomNavSource, /isPrimaryAction/);
  assert.match(bottomNavSource, /absolute -top-3 h-12 w-12 rotate-45/);
  assert.doesNotMatch(bottomNavSource, /max-w-screen-sm/);
  assert.doesNotMatch(bottomNavSource, /px-3/);
});
