import { NextRequest } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase/server';
import { createSupabaseRouteClient } from '@/lib/supabase/server-ssr';
import { DEV_SMS_AUTH_COOKIE_NAME, isDevSmsAuthEnabled } from '@/lib/dev-sms-auth';
import type { User } from '@supabase/supabase-js';

export type AuthContext = {
  userId?: string;
  supabaseUserId?: string;
  phone?: string;
  email?: string;
};

export class AuthError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(message: string, status: number, code: string) {
    super(message);
    this.name = 'AuthError';
    this.status = status;
    this.code = code;
  }
}

function extractBearerToken(request: NextRequest): string | null {
  const authorization = request.headers.get('authorization');
  if (!authorization) {
    return null;
  }

  if (!authorization.toLowerCase().startsWith('bearer ')) {
    return null;
  }

  const token = authorization.slice('bearer '.length).trim();
  return token.length > 0 ? token : null;
}

function extractLegacyAccessToken(request: NextRequest): string | null {
  const token = request.cookies.get('sb-access-token')?.value?.trim();
  return token && token.length > 0 ? token : null;
}

function extractDevAuthUserId(request: NextRequest): string | null {
  if (!isDevSmsAuthEnabled()) {
    return null;
  }

  const userId = request.cookies.get(DEV_SMS_AUTH_COOKIE_NAME)?.value?.trim();
  return userId && userId.length > 0 ? userId : null;
}

function toAuthContext(user: User): AuthContext {
  return {
    supabaseUserId: user.id,
    phone: user.phone ?? undefined,
    email: user.email ?? undefined,
  };
}

async function requireAuthByToken(token: string): Promise<AuthContext> {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin.auth.getUser(token);

  if (error || !data.user) {
    throw new AuthError('Unauthorized.', 401, 'AUTH_UNAUTHORIZED');
  }

  return toAuthContext(data.user);
}

export async function requireAuth(request: NextRequest): Promise<AuthContext> {
  const bearerToken = extractBearerToken(request);
  const legacyCookieToken = extractLegacyAccessToken(request);
  const devUserId = extractDevAuthUserId(request);

  if (bearerToken) {
    return requireAuthByToken(bearerToken);
  }

  if (legacyCookieToken) {
    try {
      return await requireAuthByToken(legacyCookieToken);
    } catch (error) {
      if (error instanceof AuthError && error.code === 'AUTH_UNAVAILABLE') {
        throw error;
      }
      // Fall back to SSR session cookies below.
    }
  }

  try {
    const supabase = await createSupabaseRouteClient();
    const { data, error } = await supabase.auth.getUser();

    if (error || !data.user) {
      if (devUserId) {
        return { userId: devUserId };
      }

      throw new AuthError('Unauthorized.', 401, 'AUTH_UNAUTHORIZED');
    }

    return toAuthContext(data.user);
  } catch (error) {
    if (devUserId) {
      return { userId: devUserId };
    }

    if (error instanceof AuthError) {
      throw error;
    }

    throw new AuthError('Authentication service unavailable.', 503, 'AUTH_UNAVAILABLE');
  }
}
