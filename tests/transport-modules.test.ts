import assert from 'node:assert/strict';
import test from 'node:test';
import {
  DEFAULT_TENANT_TRANSPORT_MODULES,
  TRANSPORT_MODULE_KEYS,
  getModuleLandingRouteForRole,
  getTransportModuleDefinition,
} from '@/lib/transport-modules';

test('transport module registry includes planned multimodal keys from the database enum', () => {
  assert.deepEqual(TRANSPORT_MODULE_KEYS, ['tricycle', 'jeepney', 'bus', 'van', 'p2p']);
  assert.equal(getTransportModuleDefinition('bus').stage, 'planned');
  assert.equal(getTransportModuleDefinition('van').stage, 'planned');
  assert.equal(getTransportModuleDefinition('p2p').stage, 'planned');
});

test('planned module routes stay safe until their workflows exist, except dedicated p2p previews', () => {
  assert.equal(getModuleLandingRouteForRole('passenger', 'bus'), '/passenger/modules');
  assert.equal(getModuleLandingRouteForRole('driver', 'van'), '/driver/modules');
  assert.equal(getModuleLandingRouteForRole('admin', 'bus'), '/admin/modules');
  assert.equal(getModuleLandingRouteForRole('passenger', 'p2p'), '/passenger/p2p');
  assert.equal(getModuleLandingRouteForRole('driver', 'p2p'), '/driver/p2p');
  assert.equal(getModuleLandingRouteForRole('admin', 'p2p'), '/admin/p2p');
});

test('default tenant transport modules keep bus, van, and p2p disabled', () => {
  const bus = DEFAULT_TENANT_TRANSPORT_MODULES.find((module) => module.moduleKey === 'bus');
  const van = DEFAULT_TENANT_TRANSPORT_MODULES.find((module) => module.moduleKey === 'van');
  const p2p = DEFAULT_TENANT_TRANSPORT_MODULES.find((module) => module.moduleKey === 'p2p');

  assert.equal(bus?.isEnabled, false);
  assert.equal(van?.isEnabled, false);
  assert.equal(p2p?.isEnabled, false);
});
