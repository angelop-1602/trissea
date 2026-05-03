import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const tenantContextSource = readFileSync('lib/tenant-context.ts', 'utf8');

test('tenant resolution avoids selecting full tenant branding records', () => {
  assert.match(tenantContextSource, /TENANT_RESOLUTION_SELECT/);
  assert.match(tenantContextSource, /id:\s*true/);
  assert.match(tenantContextSource, /select:\s*TENANT_RESOLUTION_SELECT/);
});
