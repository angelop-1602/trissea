import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateFare } from '@/lib/booking/service';
import { buildDefaultTenantSettings, normalizeTenantSettings } from '@/lib/tenant-settings';

test('default tenant settings include on-demand fare controls', () => {
  const settings = buildDefaultTenantSettings();

  assert.equal(settings.branding.logoUrl, '/mobility-logo.png');
  assert.equal(settings.branding.primaryColor, '#0F766E');
  assert.equal(settings.branding.accentColor, '#0369A1');
  assert.equal(settings.operationsPreferences.onDemandFare.baseFare, 35);
  assert.equal(settings.operationsPreferences.onDemandFare.perKmFare, 12);
  assert.equal(settings.operationsPreferences.onDemandFare.perMinuteFare, 1.5);
  assert.deepEqual(settings.operationsPreferences.onDemandFare.terminalAdjustments, []);
});

test('default tenant branding normalizes previous Mobility defaults without overriding custom logos', () => {
  const pngDefault = buildDefaultTenantSettings({
    id: 'tenant-1',
    name: 'Mobility Tenant',
    logo: '/mobility-logo.png',
    logoUrl: '/mobility-logo.png',
    primaryColor: null,
    accentColor: null,
  });
  const previousMobilityDefault = buildDefaultTenantSettings({
    id: 'tenant-3',
    name: 'Previous Mobility Tenant',
    logo: '/mobility-logo.svg',
    logoUrl: '/mobility-logo.svg',
    primaryColor: null,
    accentColor: null,
  });
  const customLogo = buildDefaultTenantSettings({
    id: 'tenant-2',
    name: 'Custom Tenant',
    logo: '/custom-logo.svg',
    logoUrl: '/custom-logo.svg',
    primaryColor: null,
    accentColor: null,
  });

  assert.equal(pngDefault.branding.logoUrl, '/mobility-logo.png');
  assert.equal(previousMobilityDefault.branding.logoUrl, '/mobility-logo.png');
  assert.equal(customLogo.branding.logoUrl, '/custom-logo.svg');
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
