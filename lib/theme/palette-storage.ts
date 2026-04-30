import {
  BRAND_TOKEN_LOCKED,
  DEFAULT_DARK_PALETTE,
  DEFAULT_LIGHT_PALETTE,
  EDITABLE_PALETTE_TOKEN_NAMES,
  type EditablePaletteTokenName,
  type ThemeMode,
  type ThemePalette,
} from '@/lib/theme/palette';

type PaletteStorage = Pick<Storage, 'getItem'> & Partial<Pick<Storage, 'setItem' | 'removeItem'>>;
type ThemeModeStorage = Pick<Storage, 'getItem'> & Partial<Pick<Storage, 'setItem' | 'removeItem'>>;

export const THEME_MODE_STORAGE_KEY = 'mobility.theme.mode';
export const DEFAULT_THEME_MODE_STORAGE_KEY = 'theme';
export const LIGHT_PALETTE_STORAGE_KEY = 'mobility.theme.palette.light';
export const DARK_PALETTE_STORAGE_KEY = 'mobility.theme.palette.dark';
export const PALETTE_STORAGE_EVENT = 'mobility:palette-updated';
const THEME_MODE_VALUES = new Set<ThemeMode>(['system', 'light', 'dark']);

function getPaletteStorageKey(mode: 'light' | 'dark') {
  return mode === 'light' ? LIGHT_PALETTE_STORAGE_KEY : DARK_PALETTE_STORAGE_KEY;
}

function getDefaultPalette(mode: 'light' | 'dark'): ThemePalette {
  return mode === 'light' ? DEFAULT_LIGHT_PALETTE : DEFAULT_DARK_PALETTE;
}

export function isStoredThemeMode(value: string | null | undefined): value is ThemeMode {
  return value != null && THEME_MODE_VALUES.has(value as ThemeMode);
}

export function isValidCssColor(value: string) {
  const trimmed = value.trim();
  if (trimmed.length === 0) return false;
  if (typeof CSS !== 'undefined' && typeof CSS.supports === 'function') {
    return CSS.supports('color', trimmed);
  }

  return /^#([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(trimmed) || /^(oklch|hsl|rgb)a?\(/i.test(trimmed);
}

function extractEditableValues(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }

  const palette = value as Record<string, unknown>;
  const result: Partial<Record<EditablePaletteTokenName, string>> = {};
  for (const token of EDITABLE_PALETTE_TOKEN_NAMES) {
    const candidate = palette[token];
    if (typeof candidate === 'string') {
      result[token] = candidate.trim();
    }
  }

  return result;
}

export function sanitizePalette(
  mode: 'light' | 'dark',
  value: unknown
): { palette: ThemePalette; invalidTokens: EditablePaletteTokenName[] } {
  const defaults = getDefaultPalette(mode);
  const candidate = extractEditableValues(value);
  const nextPalette: ThemePalette = { ...defaults };
  const invalidTokens: EditablePaletteTokenName[] = [];

  for (const token of EDITABLE_PALETTE_TOKEN_NAMES) {
    const candidateValue = candidate[token];
    if (typeof candidateValue !== 'string') continue;

    if (isValidCssColor(candidateValue)) {
      nextPalette[token] = candidateValue;
    } else {
      invalidTokens.push(token);
    }
  }

  nextPalette.brand = BRAND_TOKEN_LOCKED.brand;
  nextPalette['brand-foreground'] = BRAND_TOKEN_LOCKED.foreground;

  return { palette: nextPalette, invalidTokens };
}

function getBrowserStorage(): PaletteStorage | null {
  if (typeof window === 'undefined') {
    return null;
  }

  return window.localStorage;
}

function getThemeModeBrowserStorage(): ThemeModeStorage | null {
  if (typeof window === 'undefined') {
    return null;
  }

  return window.localStorage;
}

export function migrateThemeModeStorage(storage: ThemeModeStorage | null = getThemeModeBrowserStorage()) {
  if (!storage) {
    return null;
  }

  try {
    const current = storage.getItem(THEME_MODE_STORAGE_KEY);
    if (isStoredThemeMode(current)) {
      return null;
    }

    const fallback = storage.getItem(DEFAULT_THEME_MODE_STORAGE_KEY);
    if (!isStoredThemeMode(fallback)) {
      if (fallback && storage.removeItem) {
        storage.removeItem(DEFAULT_THEME_MODE_STORAGE_KEY);
      }
      return null;
    }

    if (storage.setItem) {
      storage.setItem(THEME_MODE_STORAGE_KEY, fallback);
    }

    if (storage.removeItem) {
      storage.removeItem(DEFAULT_THEME_MODE_STORAGE_KEY);
    }

    return fallback;
  } catch {
    return null;
  }
}

export function readPaletteFromStorage(mode: 'light' | 'dark', storage: PaletteStorage | null = getBrowserStorage()) {
  if (!storage) {
    return getDefaultPalette(mode);
  }

  try {
    const nextKey = getPaletteStorageKey(mode);
    const raw = storage.getItem(nextKey);
    if (!raw) return getDefaultPalette(mode);
    const parsed = JSON.parse(raw) as unknown;
    return sanitizePalette(mode, parsed).palette;
  } catch {
    return getDefaultPalette(mode);
  }
}

export function writePaletteToStorage(mode: 'light' | 'dark', palette: unknown) {
  const storage = getBrowserStorage();
  if (!storage) return;

  try {
    const sanitized = sanitizePalette(mode, palette).palette;
    storage.setItem?.(getPaletteStorageKey(mode), JSON.stringify(sanitized));
    window.dispatchEvent(new Event(PALETTE_STORAGE_EVENT));
  } catch {
    // Ignore storage failures so theme customization stays best-effort.
  }
}
