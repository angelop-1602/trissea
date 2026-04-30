import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateFare } from '@/lib/booking/service';
import { buildDefaultTenantSettings, normalizeTenantSettings } from '@/lib/tenant-settings';

test('default tenant settings include on-demand fare controls', () => {
  const settings = buildDefaultTenantSettings();

  assert.equal(settings.branding.logoUrl, '/trissea-logo.png');
  assert.equal(settings.branding.faviconUrl, '/trissea-icon-32.png');
  assert.equal(settings.branding.primaryColor, '#14622e');
  assert.equal(settings.branding.accentColor, '#fecc04');
  assert.equal(settings.branding.backgroundColor, '#f5f9f7');
  assert.equal(settings.branding.foregroundColor, '#0f1f16');
  assert.equal(settings.operationsPreferences.onDemandFare.baseFare, 35);
  assert.equal(settings.operationsPreferences.onDemandFare.perKmFare, 12);
  assert.equal(settings.operationsPreferences.onDemandFare.perMinuteFare, 1.5);
  assert.deepEqual(settings.operationsPreferences.onDemandFare.terminalAdjustments, []);
});

test('default tenant branding uses TRISSEA fallbacks without overriding custom logos', () => {
  const fallbackBranding = buildDefaultTenantSettings({
    id: 'tenant-1',
    name: 'TRISSEA Tenant',
    logo: '',
    logoUrl: '',
    primaryColor: null,
    accentColor: null,
    backgroundColor: null,
    foregroundColor: null,
    driverPrimaryColor: null,
    driverAccentColor: null,
    driverBackgroundColor: null,
    driverForegroundColor: null,
    faviconUrl: null,
  });
  const customLogo = buildDefaultTenantSettings({
    id: 'tenant-2',
    name: 'Custom Tenant',
    logo: '/custom-logo.svg',
    logoUrl: '/custom-logo.svg',
    primaryColor: '#123456',
    accentColor: '#abcdef',
    backgroundColor: '#fafafa',
    foregroundColor: '#111111',
    driverPrimaryColor: '#234567',
    driverAccentColor: '#fedcba',
    driverBackgroundColor: '#f7f7f7',
    driverForegroundColor: '#222222',
    faviconUrl: '/custom-favicon.png',
  });

  assert.equal(fallbackBranding.branding.logoUrl, '/trissea-logo.png');
  assert.equal(fallbackBranding.branding.primaryColor, '#14622e');
  assert.equal(customLogo.branding.logoUrl, '/custom-logo.svg');
  assert.equal(customLogo.branding.primaryColor, '#123456');
  assert.equal(customLogo.branding.driverAccentColor, '#fedcba');
});

test('tenant settings normalize custom on-demand fare values and terminal adjustments', () => {
  const settings = normalizeTenantSettings({
    operationsPreferences: {
      onDemandFare: {
        baseFare: 42.755,
        perKmFare: 10.5,
        perMinuteFare: 2.25,
        terminalAdjustments: [
          { terminalId: 'terminal-centro', amount: 15.236 },
          { terminalId: 'terminal-centro', amount: 99 },
          { terminalId: 'terminal-ugac', amount: 0 },
          { terminalId: 'terminal-caggay', amount: -7.499 },
        ],
      },
    },
  });

  assert.equal(settings.operationsPreferences.onDemandFare.baseFare, 42.76);
  assert.equal(settings.operationsPreferences.onDemandFare.perKmFare, 10.5);
  assert.equal(settings.operationsPreferences.onDemandFare.perMinuteFare, 2.25);
  assert.deepEqual(settings.operationsPreferences.onDemandFare.terminalAdjustments, [
    { terminalId: 'terminal-centro', amount: 15.24 },
    { terminalId: 'terminal-caggay', amount: -7.5 },
  ]);
});

test('calculateFare applies tenant fare formula and terminal adjustment', () => {
  const fare = calculateFare(
    3.75,
    14,
    {
      baseFare: 40,
      perKmFare: 11.5,
      perMinuteFare: 1.75,
      terminalAdjustments: [],
    },
    8
  );

  assert.equal(fare.baseFare, 40);
  assert.equal(fare.perKmFare, 43.13);
  assert.equal(fare.perMinuteFare, 24.5);
  assert.equal(fare.terminalAdjustment, 8);
  assert.equal(fare.totalFare, 115.63);
});
