export type ThemeMode = 'system' | 'light' | 'dark';

export const BRAND_TOKEN_LOCKED = {
  brand: '#0369A1',
  foreground: '#F0FDFA',
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
  background: '#F0FDFA',
  foreground: '#0F172A',
  card: '#FFFFFF',
  'card-foreground': '#0F172A',
  popover: '#FFFFFF',
  'popover-foreground': '#0F172A',
  primary: '#0F766E',
  'primary-foreground': '#F0FDFA',
  secondary: '#0369A1',
  'secondary-foreground': '#F8FAFC',
  muted: '#E6FFFB',
  'muted-foreground': '#475569',
  accent: '#DBEAFE',
  'accent-foreground': '#0F172A',
  destructive: '#DC2626',
  'destructive-foreground': '#F8FAFC',
  border: '#BFE3DF',
  input: '#D2F4EE',
  ring: BRAND_TOKEN_LOCKED.brand,
  'chart-1': '#0F766E',
  'chart-2': '#0369A1',
  'chart-3': '#155E75',
  'chart-4': '#0EA5E9',
  'chart-5': '#14B8A6',
  sidebar: '#F8FFFD',
  'sidebar-foreground': '#0F172A',
  'sidebar-primary': '#0F766E',
  'sidebar-primary-foreground': '#F0FDFA',
  'sidebar-accent': '#DBEAFE',
  'sidebar-accent-foreground': '#0F172A',
  'sidebar-border': '#BFE3DF',
  'sidebar-ring': BRAND_TOKEN_LOCKED.brand,
  brand: BRAND_TOKEN_LOCKED.brand,
  'brand-foreground': BRAND_TOKEN_LOCKED.foreground,
};

export const DEFAULT_DARK_PALETTE: ThemePalette = {
  background: '#041F24',
  foreground: '#E6FFFB',
  card: '#0B2C33',
  'card-foreground': '#E6FFFB',
  popover: '#0B2C33',
  'popover-foreground': '#E6FFFB',
  primary: '#2DD4BF',
  'primary-foreground': '#042F2E',
  secondary: '#38BDF8',
  'secondary-foreground': '#082F49',
  muted: '#123741',
  'muted-foreground': '#A7C7CE',
  accent: '#163B4A',
  'accent-foreground': '#E6FFFB',
  destructive: '#F87171',
  'destructive-foreground': '#111827',
  border: '#194750',
  input: 'rgb(230 255 251 / 15%)',
  ring: BRAND_TOKEN_LOCKED.brand,
  'chart-1': '#2DD4BF',
  'chart-2': '#38BDF8',
  'chart-3': '#67E8F9',
  'chart-4': '#0EA5E9',
  'chart-5': '#22D3EE',
  sidebar: '#07252B',
  'sidebar-foreground': '#E6FFFB',
  'sidebar-primary': '#2DD4BF',
  'sidebar-primary-foreground': '#042F2E',
  'sidebar-accent': '#123741',
  'sidebar-accent-foreground': '#E6FFFB',
  'sidebar-border': 'rgb(230 255 251 / 12%)',
  'sidebar-ring': BRAND_TOKEN_LOCKED.brand,
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
