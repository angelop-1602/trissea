import { createClient } from '@supabase/supabase-js';

function getEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing environment variable: ${name}`);
  }
  return value;
}

export function createSupabaseBrowserClient() {
  const url = getEnv('NEXT_PUBLIC_SUPABASE_URL');
  const anonKey = getEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY');
  return createClient(url, anonKey);
}
