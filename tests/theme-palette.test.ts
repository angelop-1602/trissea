import assert from 'node:assert/strict';
import test from 'node:test';
import { buildPaletteStyleTagCss, DEFAULT_DARK_PALETTE, DEFAULT_LIGHT_PALETTE } from '@/lib/theme/palette';
import {
  DEFAULT_THEME_MODE_STORAGE_KEY,
  LIGHT_PALETTE_STORAGE_KEY,
  THEME_MODE_STORAGE_KEY,
  migrateThemeModeStorage,
  readPaletteFromStorage,
  sanitizePalette,
} from '@/lib/theme/palette-storage';

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

test('buildPaletteStyleTagCss writes both :root and .dark blocks', () => {
  const css = buildPaletteStyleTagCss(DEFAULT_LIGHT_PALETTE, DEFAULT_DARK_PALETTE);
  assert.match(css, /:root\s*\{/);
  assert.match(css, /\.dark\s*\{/);
  assert.match(css, /--background:/);
  assert.match(css, /--brand:/);
});

test('sanitizePalette fills missing keys from defaults', () => {
  const { palette } = sanitizePalette('light', {
    background: 'oklch(0.99 0.01 100)',
  });

  assert.equal(palette.background, 'oklch(0.99 0.01 100)');
  assert.equal(palette.foreground, DEFAULT_LIGHT_PALETTE.foreground);
});

test('sanitizePalette drops invalid values and reports invalid tokens', () => {
  const { palette, invalidTokens } = sanitizePalette('dark', {
    background: 'nope',
    ring: 'oklch(0.7 0.1 70)',
  });

  assert.deepEqual(invalidTokens, ['background']);
  assert.equal(palette.background, DEFAULT_DARK_PALETTE.background);
  assert.equal(palette.ring, 'oklch(0.7 0.1 70)');
});

test('sanitizePalette always keeps locked brand tokens', () => {
  const { palette } = sanitizePalette('light', {
    brand: 'oklch(0.1 0.1 0)',
    'brand-foreground': 'oklch(0.9 0 0)',
  });

  assert.equal(palette.brand, DEFAULT_LIGHT_PALETTE.brand);
  assert.equal(palette['brand-foreground'], DEFAULT_LIGHT_PALETTE['brand-foreground']);
});

test('readPaletteFromStorage uses the Mobility palette namespace', () => {
  const storage = createStorage({
    [LIGHT_PALETTE_STORAGE_KEY]: JSON.stringify({
      background: '#ffffff',
      foreground: '#0f172a',
    }),
  });

  const palette = readPaletteFromStorage('light', storage);

  assert.equal(palette.background, '#ffffff');
});

test('migrateThemeModeStorage moves the default theme mode into the Mobility namespace', () => {
  const storage = createStorage({
    [DEFAULT_THEME_MODE_STORAGE_KEY]: 'dark',
  });

  const mode = migrateThemeModeStorage(storage);

  assert.equal(mode, 'dark');
  assert.equal(storage.getItem(THEME_MODE_STORAGE_KEY), 'dark');
  assert.equal(storage.getItem(DEFAULT_THEME_MODE_STORAGE_KEY), null);
});
