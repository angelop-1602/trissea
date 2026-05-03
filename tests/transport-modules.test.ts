import assert from 'node:assert/strict';
import test from 'node:test';
import {
  DEFAULT_TENANT_TRANSPORT_MODULES,
  TRANSPORT_MODULE_KEYS,
  getModuleLandingRouteForRole,
  getTransportModuleDefinition,
} from '@/lib/transport-modules';

test('transport module registry includes planned multimodal keys from the database enum', () => {
  assert.deepEqual(TRANSPORT_MODULE_KEYS, ['tricycle', 'jeepney', 'bus', 'van']);
  assert.equal(getTransportModuleDefinition('bus').stage, 'planned');
  assert.equal(getTransportModuleDefinition('van').stage, 'planned');
});

test('planned bus and van modules use safe module hub routes until workflows exist', () => {
  assert.equal(getModuleLandingRouteForRole('passenger', 'bus'), '/passenger/modules');
  assert.equal(getModuleLandingRouteForRole('driver', 'van'), '/driver/modules');
  assert.equal(getModuleLandingRouteForRole('admin', 'bus'), '/admin/modules');
});

test('default tenant transport modules keep bus and van disabled', () => {
  const bus = DEFAULT_TENANT_TRANSPORT_MODULES.find((module) => module.moduleKey === 'bus');
  const van = DEFAULT_TENANT_TRANSPORT_MODULES.find((module) => module.moduleKey === 'van');

  assert.equal(bus?.isEnabled, false);
  assert.equal(van?.isEnabled, false);
});
