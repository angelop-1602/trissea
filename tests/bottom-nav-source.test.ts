import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const bottomNavSource = readFileSync('components/bottom-nav.tsx', 'utf8');

test('bottom navigation uses one active indicator without the extra dot badge', () => {
  assert.match(bottomNavSource, /aria-current=\{isActive \? 'page' : undefined\}/);
  assert.doesNotMatch(bottomNavSource, /import\s+\{[^}]*\bDot\b[^}]*\}\s+from 'lucide-react'/);
  assert.doesNotMatch(bottomNavSource, /<Dot\b/);
});
