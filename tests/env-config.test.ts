import test from 'node:test';
import assert from 'node:assert/strict';
import { validateProductionRuntimeEnv } from '@/lib/env-config';

test('validateProductionRuntimeEnv passes in non-production without strict secrets', () => {
  assert.doesNotThrow(() =>
    validateProductionRuntimeEnv({
      NODE_ENV: 'development',
      DATABASE_URL: '',
      NEXT_PUBLIC_SUPABASE_URL: '',
      NEXT_PUBLIC_SUPABASE_ANON_KEY: '',
      SUPABASE_SERVICE_ROLE_KEY: '',
    })
  );
});

test('validateProductionRuntimeEnv throws when required vars are missing in production', () => {
  assert.throws(
    () =>
      validateProductionRuntimeEnv({
        NODE_ENV: 'production',
        DATABASE_URL: '',
        NEXT_PUBLIC_SUPABASE_URL: '',
        NEXT_PUBLIC_SUPABASE_ANON_KEY: '',
        SUPABASE_SERVICE_ROLE_KEY: '',
      }),
    /Missing required production env vars/
  );
});

test('validateProductionRuntimeEnv passes with required production vars', () => {
  assert.doesNotThrow(() =>
    validateProductionRuntimeEnv({
      NODE_ENV: 'production',
      DATABASE_URL: 'postgres://x',
      NEXT_PUBLIC_SUPABASE_URL: 'https://example.supabase.co',
      NEXT_PUBLIC_SUPABASE_ANON_KEY: 'anon',
      SUPABASE_SERVICE_ROLE_KEY: 'service',
    })
  );
});
