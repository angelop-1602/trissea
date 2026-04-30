import {
  TRISSEA_ACCENT_FOREGROUND_HEX,
  TRISSEA_ACCENT_HEX,
  TRISSEA_BACKGROUND_HEX,
  TRISSEA_FOREGROUND_HEX,
  TRISSEA_PRIMARY_FOREGROUND_HEX,
  TRISSEA_PRIMARY_HEX,
} from '@/lib/theme/constants';

export type ThemeMode = 'system' | 'light' | 'dark';

export const BRAND_TOKEN_LOCKED = {
  brand: TRISSEA_PRIMARY_HEX,
  foreground: TRISSEA_PRIMARY_FOREGROUND_HEX,
} as const;

export const PALETTE_TOKEN_NAMES = [
  'background',
  'foreground',
  'card',
  'card-foreground',
  'popover',
  'popover-foreground',
  'primary',
  'primary-foreground',
  'secondary',
  'secondary-foreground',
  'muted',
  'muted-foreground',
  'accent',
  'accent-foreground',
  'destructive',
  'destructive-foreground',
  'success',
  'success-foreground',
  'warning',
  'warning-foreground',
  'info',
  'info-foreground',
  'border',
  'input',
  'ring',
  'chart-1',
  'chart-2',
  'chart-3',
  'chart-4',
  'chart-5',
  'sidebar',
  'sidebar-foreground',
  'sidebar-primary',
  'sidebar-primary-foreground',
  'sidebar-accent',
  'sidebar-accent-foreground',
  'sidebar-border',
  'sidebar-ring',
  'brand',
  'brand-foreground',
] as const;

export const EDITABLE_PALETTE_TOKEN_NAMES = PALETTE_TOKEN_NAMES.filter(
  (name) => name !== 'brand' && name !== 'brand-foreground'
);

export type PaletteTokenName = (typeof PALETTE_TOKEN_NAMES)[number];
export type EditablePaletteTokenName = (typeof EDITABLE_PALETTE_TOKEN_NAMES)[number];
export type ThemePalette = Record<PaletteTokenName, string>;
export type EditableThemePalette = Record<EditablePaletteTokenName, string>;

export const DEFAULT_LIGHT_PALETTE: ThemePalette = {
  background: TRISSEA_BACKGROUND_HEX,
  foreground: TRISSEA_FOREGROUND_HEX,
  card: '#ffffff',
  'card-foreground': TRISSEA_FOREGROUND_HEX,
  popover: '#ffffff',
  'popover-foreground': TRISSEA_FOREGROUND_HEX,
  primary: TRISSEA_PRIMARY_HEX,
  'primary-foreground': TRISSEA_PRIMARY_FOREGROUND_HEX,
  secondary: '#e7f1eb',
  'secondary-foreground': TRISSEA_FOREGROUND_HEX,
  muted: '#eaf2ee',
  'muted-foreground': '#5b6b61',
  accent: TRISSEA_ACCENT_HEX,
  'accent-foreground': TRISSEA_ACCENT_FOREGROUND_HEX,
  destructive: '#dc2626',
  'destructive-foreground': '#ffffff',
  success: '#16803a',
  'success-foreground': '#ffffff',
  warning: '#b7791f',
  'warning-foreground': '#0f1f16',
  info: '#2563eb',
  'info-foreground': '#ffffff',
  border: '#cddbd2',
  input: '#d8e6dd',
  ring: TRISSEA_PRIMARY_HEX,
  'chart-1': TRISSEA_PRIMARY_HEX,
  'chart-2': TRISSEA_ACCENT_HEX,
  'chart-3': '#3f8f58',
  'chart-4': '#91b99c',
  'chart-5': '#4f6f5a',
  sidebar: '#ffffff',
  'sidebar-foreground': TRISSEA_FOREGROUND_HEX,
  'sidebar-primary': TRISSEA_PRIMARY_HEX,
  'sidebar-primary-foreground': TRISSEA_PRIMARY_FOREGROUND_HEX,
  'sidebar-accent': '#fff4b8',
  'sidebar-accent-foreground': TRISSEA_FOREGROUND_HEX,
  'sidebar-border': '#d8e6dd',
  'sidebar-ring': TRISSEA_PRIMARY_HEX,
  brand: BRAND_TOKEN_LOCKED.brand,
  'brand-foreground': BRAND_TOKEN_LOCKED.foreground,
};

export const DEFAULT_DARK_PALETTE: ThemePalette = {
  background: '#07150d',
  foreground: '#f5f9f7',
  card: '#0d2115',
  'card-foreground': '#f5f9f7',
  popover: '#0d2115',
  'popover-foreground': '#f5f9f7',
  primary: '#49b46b',
  'primary-foreground': '#041007',
  secondary: '#143420',
  'secondary-foreground': '#e4f3e9',
  muted: '#13261a',
  'muted-foreground': '#b8c9be',
  accent: TRISSEA_ACCENT_HEX,
  'accent-foreground': TRISSEA_ACCENT_FOREGROUND_HEX,
  destructive: '#f87171',
  'destructive-foreground': '#210707',
  success: '#4ade80',
  'success-foreground': '#041007',
  warning: '#facc15',
  'warning-foreground': '#1f1600',
  info: '#60a5fa',
  'info-foreground': '#061325',
  border: '#21442d',
  input: 'rgb(245 249 247 / 15%)',
  ring: '#49b46b',
  'chart-1': '#49b46b',
  'chart-2': TRISSEA_ACCENT_HEX,
  'chart-3': '#86efac',
  'chart-4': '#d9b200',
  'chart-5': '#93c5fd',
  sidebar: '#0a1b11',
  'sidebar-foreground': '#f5f9f7',
  'sidebar-primary': '#49b46b',
  'sidebar-primary-foreground': '#041007',
  'sidebar-accent': '#2c290c',
  'sidebar-accent-foreground': '#f5f9f7',
  'sidebar-border': 'rgb(245 249 247 / 12%)',
  'sidebar-ring': '#49b46b',
  brand: BRAND_TOKEN_LOCKED.brand,
  'brand-foreground': BRAND_TOKEN_LOCKED.foreground,
};

function toCssVariablesCss(palette: ThemePalette) {
  return PALETTE_TOKEN_NAMES.map((token) => `  --${token}: ${palette[token]};`).join('\n');
}

export function buildPaletteStyleTagCss(lightPalette: ThemePalette, darkPalette: ThemePalette) {
  return `:root {\n${toCssVariablesCss(lightPalette)}\n}\n\n.dark {\n${toCssVariablesCss(
    darkPalette
  )}\n}`;
}
