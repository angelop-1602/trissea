import type { CSSProperties } from 'react';
import {
  DEFAULT_ACCENT_HEX,
  DEFAULT_BACKGROUND_HEX,
  DEFAULT_FOREGROUND_HEX,
  DEFAULT_PRIMARY_HEX,
  TRISSEA_ACCENT_FOREGROUND_HEX,
  TRISSEA_PRIMARY_FOREGROUND_HEX,
} from '@/lib/theme/constants';

export type ThemeRole = 'platform' | 'tenant' | 'driver';

export type ThemeVariableStyle = CSSProperties & Record<`--${string}`, string>;

export interface TenantThemeInput {
  primaryColor?: string | null;
  accentColor?: string | null;
  backgroundColor?: string | null;
  foregroundColor?: string | null;
  driverPrimaryColor?: string | null;
  driverAccentColor?: string | null;
  driverBackgroundColor?: string | null;
  driverForegroundColor?: string | null;
}

export interface ResolvedRoleTheme {
  primary: string;
  primaryForeground: string;
  accent: string;
  accentForeground: string;
  background: string;
  foreground: string;
  card: string;
  border: string;
}

export interface ResolvedTenantTheme {
  tenant: ResolvedRoleTheme;
  driver: ResolvedRoleTheme;
}

export function normalizeHexColor(value: string | null | undefined, fallback?: string) {
  const trimmed = value?.trim();
  if (!trimmed) {
    return fallback;
  }

  const shorthand = /^#([0-9a-f]{3})$/i.exec(trimmed);
  if (shorthand) {
    return `#${shorthand[1]
      .split('')
      .map((part) => `${part}${part}`)
      .join('')}`.toLowerCase();
  }

  if (/^#[0-9a-f]{6}$/i.test(trimmed)) {
    return trimmed.toLowerCase();
  }

  return fallback;
}

function hexToRgb(hex: string) {
  const normalized = normalizeHexColor(hex, DEFAULT_PRIMARY_HEX) ?? DEFAULT_PRIMARY_HEX;
  return {
    red: Number.parseInt(normalized.slice(1, 3), 16),
    green: Number.parseInt(normalized.slice(3, 5), 16),
    blue: Number.parseInt(normalized.slice(5, 7), 16),
  };
}

function rgbToHex(red: number, green: number, blue: number) {
  return `#${[red, green, blue]
    .map((channel) => Math.max(0, Math.min(255, Math.round(channel))).toString(16).padStart(2, '0'))
    .join('')}`;
}

function mixHex(left: string, right: string, leftWeight: number) {
  const a = hexToRgb(left);
  const b = hexToRgb(right);
  const weight = Math.max(0, Math.min(1, leftWeight));
  return rgbToHex(
    a.red * weight + b.red * (1 - weight),
    a.green * weight + b.green * (1 - weight),
    a.blue * weight + b.blue * (1 - weight)
  );
}

function relativeLuminance(hex: string) {
  const rgb = hexToRgb(hex);
  const values = [rgb.red, rgb.green, rgb.blue].map((channel) => {
    const normalized = channel / 255;
    return normalized <= 0.03928
      ? normalized / 12.92
      : Math.pow((normalized + 0.055) / 1.055, 2.4);
  });

  return values[0] * 0.2126 + values[1] * 0.7152 + values[2] * 0.0722;
}

export function getReadableForeground(hex: string) {
  return relativeLuminance(hex) > 0.52 ? '#0f1f16' : '#ffffff';
}

function buildRoleTheme(input: {
  primary: string;
  accent: string;
  background: string;
  foreground: string;
}): ResolvedRoleTheme {
  return {
    primary: input.primary,
    primaryForeground: getReadableForeground(input.primary),
    accent: input.accent,
    accentForeground: getReadableForeground(input.accent),
    background: input.background,
    foreground: input.foreground,
    card: mixHex('#ffffff', input.background, 0.86),
    border: mixHex(input.primary, input.background, 0.24),
  };
}

export function resolveTenantTheme(input: TenantThemeInput | null | undefined): ResolvedTenantTheme {
  const tenantPrimary = normalizeHexColor(input?.primaryColor, DEFAULT_PRIMARY_HEX) ?? DEFAULT_PRIMARY_HEX;
  const tenantAccent = normalizeHexColor(input?.accentColor, DEFAULT_ACCENT_HEX) ?? DEFAULT_ACCENT_HEX;
  const tenantBackground = normalizeHexColor(input?.backgroundColor, DEFAULT_BACKGROUND_HEX) ?? DEFAULT_BACKGROUND_HEX;
  const tenantForeground = normalizeHexColor(input?.foregroundColor, DEFAULT_FOREGROUND_HEX) ?? DEFAULT_FOREGROUND_HEX;

  const tenant = buildRoleTheme({
    primary: tenantPrimary,
    accent: tenantAccent,
    background: tenantBackground,
    foreground: tenantForeground,
  });

  const driverPrimary =
    normalizeHexColor(input?.driverPrimaryColor) ?? mixHex(tenantPrimary, '#000000', 0.86);
  const driverAccent = normalizeHexColor(input?.driverAccentColor) ?? tenantAccent;
  const driverBackground = normalizeHexColor(input?.driverBackgroundColor) ?? tenantBackground;
  const driverForeground = normalizeHexColor(input?.driverForegroundColor) ?? tenantForeground;

  return {
    tenant,
    driver: buildRoleTheme({
      primary: driverPrimary,
      accent: driverAccent,
      background: driverBackground,
      foreground: driverForeground,
    }),
  };
}

function semanticVariables(theme: ResolvedRoleTheme): ThemeVariableStyle {
  return {
    '--background': theme.background,
    '--foreground': theme.foreground,
    '--card': theme.card,
    '--card-foreground': theme.foreground,
    '--popover': theme.card,
    '--popover-foreground': theme.foreground,
    '--primary': theme.primary,
    '--primary-foreground': theme.primaryForeground,
    '--secondary': mixHex(theme.primary, theme.background, 0.12),
    '--secondary-foreground': theme.foreground,
    '--muted': mixHex(theme.primary, theme.background, 0.08),
    '--muted-foreground': mixHex(theme.foreground, theme.background, 0.68),
    '--accent': theme.accent,
    '--accent-foreground': theme.accentForeground,
    '--border': theme.border,
    '--input': mixHex(theme.border, theme.background, 0.8),
    '--ring': theme.primary,
    '--sidebar': theme.card,
    '--sidebar-foreground': theme.foreground,
    '--sidebar-primary': theme.primary,
    '--sidebar-primary-foreground': theme.primaryForeground,
    '--sidebar-accent': mixHex(theme.accent, theme.background, 0.22),
    '--sidebar-accent-foreground': theme.foreground,
    '--sidebar-border': theme.border,
    '--sidebar-ring': theme.primary,
  };
}

function roleVariables(prefix: 'tenant' | 'driver', theme: ResolvedRoleTheme): ThemeVariableStyle {
  return {
    [`--${prefix}-primary`]: theme.primary,
    [`--${prefix}-primary-foreground`]: theme.primaryForeground,
    [`--${prefix}-accent`]: theme.accent,
    [`--${prefix}-accent-foreground`]: theme.accentForeground,
    [`--${prefix}-background`]: theme.background,
    [`--${prefix}-foreground`]: theme.foreground,
    [`--${prefix}-card`]: theme.card,
    [`--${prefix}-border`]: theme.border,
  };
}

export function getPlatformThemeVariables(): ThemeVariableStyle {
  const theme = buildRoleTheme({
    primary: DEFAULT_PRIMARY_HEX,
    accent: DEFAULT_ACCENT_HEX,
    background: DEFAULT_BACKGROUND_HEX,
    foreground: DEFAULT_FOREGROUND_HEX,
  });

  return {
    ...semanticVariables({
      ...theme,
      primaryForeground: TRISSEA_PRIMARY_FOREGROUND_HEX,
      accentForeground: TRISSEA_ACCENT_FOREGROUND_HEX,
    }),
    ...roleVariables('tenant', theme),
    ...roleVariables('driver', {
      ...theme,
      primary: mixHex(DEFAULT_PRIMARY_HEX, '#000000', 0.86),
      primaryForeground: '#ffffff',
    }),
  };
}

export function getTenantThemeVariables(
  input: TenantThemeInput | null | undefined,
  role: Exclude<ThemeRole, 'platform'> = 'tenant'
): ThemeVariableStyle {
  const resolved = resolveTenantTheme(input);
  const active = role === 'driver' ? resolved.driver : resolved.tenant;

  return {
    ...semanticVariables(active),
    ...roleVariables('tenant', resolved.tenant),
    ...roleVariables('driver', resolved.driver),
  };
}
