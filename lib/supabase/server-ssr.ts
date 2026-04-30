import { createServerClient } from '@supabase/ssr';
import type { SupabaseClient, User } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import { ensureProductionRuntimeEnv } from '@/lib/env-config';

function getEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing environment variable: ${name}`);
  }
  return value;
}

type AnySupabaseClient = SupabaseClient<any, 'public', any>;

export async function createSupabaseRouteClient(): Promise<AnySupabaseClient> {
  ensureProductionRuntimeEnv();

  const cookieStore = await cookies();
  const url = getEnv('NEXT_PUBLIC_SUPABASE_URL');
  const anonKey = getEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY');

  return createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        for (const cookie of cookiesToSet) {
          cookieStore.set(cookie.name, cookie.value, cookie.options);
        }
      },
    },
  });
}

export async function updateProxySession(
  request: NextRequest
): Promise<{ response: NextResponse; user: User | null }> {
  ensureProductionRuntimeEnv();

  const url = getEnv('NEXT_PUBLIC_SUPABASE_URL');
  const anonKey = getEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY');

  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        for (const cookie of cookiesToSet) {
          try {
            request.cookies.set(cookie.name, cookie.value);
          } catch {
            // no-op: request cookies may be immutable in some environments
          }
        }

        response = NextResponse.next({
          request: {
            headers: request.headers,
          },
        });

        for (const cookie of cookiesToSet) {
          response.cookies.set(cookie.name, cookie.value, cookie.options);
        }
      },
    },
  });

  const { data } = await supabase.auth.getUser();
  return { response, user: data.user ?? null };
}
