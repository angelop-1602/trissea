type EnvSource = Record<string, string | undefined>;

const globalForEnvValidation = globalThis as unknown as {
  __mobilityEnvValidated: boolean | undefined;
};

function readTrimmed(env: EnvSource, key: string): string {
  return env[key]?.trim() ?? '';
}

function missingRequiredKeys(env: EnvSource, keys: string[]) {
  return keys.filter((key) => readTrimmed(env, key).length === 0);
}

export function validateProductionRuntimeEnv(env: EnvSource = process.env): void {
  if (readTrimmed(env, 'NODE_ENV') !== 'production') {
    return;
  }

  const required = [
    'DATABASE_URL',
    'NEXT_PUBLIC_SUPABASE_URL',
    'NEXT_PUBLIC_SUPABASE_ANON_KEY',
    'SUPABASE_SERVICE_ROLE_KEY',
  ];

  const missing = missingRequiredKeys(env, required);
  if (missing.length > 0) {
    throw new Error(`Missing required production env vars: ${missing.join(', ')}`);
  }
}

export function ensureProductionRuntimeEnv(): void {
  if (globalForEnvValidation.__mobilityEnvValidated) {
    return;
  }

  validateProductionRuntimeEnv(process.env);
  globalForEnvValidation.__mobilityEnvValidated = true;
}

