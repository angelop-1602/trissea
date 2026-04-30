import assert from 'node:assert/strict';
import test from 'node:test';
import {
  getPlatformThemeVariables,
  getTenantThemeVariables,
  normalizeHexColor,
  resolveTenantTheme,
} from '@/lib/theme/tenant-theme';

test('normalizeHexColor accepts short and long hex values', () => {
  assert.equal(normalizeHexColor('#ABC'), '#aabbcc');
  assert.equal(normalizeHexColor('#14622E'), '#14622e');
  assert.equal(normalizeHexColor('not-a-color', '#14622e'), '#14622e');
});

test('platform theme variables stay fixed to TRISSEA colors', () => {
  const style = getPlatformThemeVariables();

  assert.equal(style['--primary'], '#14622e');
  assert.equal(style['--accent'], '#fecc04');
  assert.equal(style['--background'], '#f5f9f7');
  assert.equal(style['--foreground'], '#0f1f16');
});

test('tenant theme variables map custom tenant colors to semantic tokens', () => {
  const style = getTenantThemeVariables(
    {
      primaryColor: '#123',
      accentColor: '#fedcba',
      backgroundColor: '#fafafa',
      foregroundColor: '#111111',
    },
    'tenant'
  );

  assert.equal(style['--tenant-primary'], '#112233');
  assert.equal(style['--tenant-accent'], '#fedcba');
  assert.equal(style['--primary'], '#112233');
  assert.equal(style['--background'], '#fafafa');
});

test('driver theme derives safe colors when driver values are absent', () => {
  const resolved = resolveTenantTheme({
    primaryColor: '#14622e',
    accentColor: '#fecc04',
    backgroundColor: '#f5f9f7',
    foregroundColor: '#0f1f16',
  });
  const style = getTenantThemeVariables(
    {
      primaryColor: '#14622e',
      accentColor: '#fecc04',
      backgroundColor: '#f5f9f7',
      foregroundColor: '#0f1f16',
    },
    'driver'
  );

  assert.notEqual(resolved.driver.primary, resolved.tenant.primary);
  assert.equal(style['--driver-accent'], '#fecc04');
  assert.equal(style['--primary'], resolved.driver.primary);
});
