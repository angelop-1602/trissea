import { NextRequest } from 'next/server';
import { z } from 'zod';
import { createSupabaseAnonServerClient } from '@/lib/supabase/server';
import { getPrisma } from '@/lib/prisma';
import { assertActiveAdminTenantMembership } from '@/lib/tenant-rbac';
import {
  bookingError,
  bookingErrorResponse,
  bookingSuccess,
  getRequestIdFromHeaders,
  rateLimitedResponse,
} from '@/lib/booking/http';
import { checkEndpointRateLimit } from '@/lib/security/rate-limit-endpoint';

const bodySchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export async function POST(request: NextRequest) {
  const requestId = getRequestIdFromHeaders(request.headers);
  const prisma = getPrisma();
  const json = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);

  if (!parsed.success) {
    return bookingError(requestId, 'Invalid request body.', 400, 'INVALID_REQUEST');
  }

  const normalizedEmail = parsed.data.email.trim().toLowerCase();

  const ipLimit = await checkEndpointRateLimit(request, {
    scope: 'auth.email.login.ip',
    limit: 30,
    windowMs: 10 * 60_000,
  });
  if (!ipLimit.allowed) {
    return rateLimitedResponse(requestId, ipLimit.retryAfterSeconds);
  }

  const emailLimit = await checkEndpointRateLimit(request, {
    scope: 'auth.email.login.email',
    limit: 10,
    windowMs: 10 * 60_000,
    keyParts: [normalizedEmail],
  });
  if (!emailLimit.allowed) {
    return rateLimitedResponse(requestId, emailLimit.retryAfterSeconds);
  }

  try {
    const supabase = createSupabaseAnonServerClient();
    const { data, error } = await supabase.auth.signInWithPassword({
      email: normalizedEmail,
      password: parsed.data.password,
    });

    if (error || !data.user || !data.session) {
      const errorMessage = error?.message?.toLowerCase() ?? '';
      if (errorMessage.includes('email logins are disabled')) {
        return bookingError(
          requestId,
          'Email/password sign-in is disabled in Supabase Auth. Enable the Email provider before signing in with admin accounts.',
          503,
          'AUTH_EMAIL_DISABLED'
        );
      }

      return bookingError(requestId, 'Invalid email or password.', 401, 'AUTH_UNAUTHORIZED');
    }

    let profile = await prisma.user.findUnique({
      where: { supabaseId: data.user.id },
    });

    if (!profile) {
      const profileByEmail = await prisma.user.findFirst({
        where: {
          email: {
            equals: normalizedEmail,
            mode: 'insensitive',
          },
          role: {
            in: ['admin', 'superadmin'],
          },
        },
        orderBy: { createdAt: 'asc' },
      });

      if (profileByEmail && (!profileByEmail.supabaseId || profileByEmail.supabaseId === data.user.id)) {
        profile =
          profileByEmail.supabaseId === data.user.id
            ? profileByEmail
            : await prisma.user.update({
                where: { id: profileByEmail.id },
                data: {
                  supabaseId: data.user.id,
                  updatedAt: new Date(),
                },
              });
      }
    }

    if (!profile) {
      return bookingError(requestId, 'Invalid email or password.', 401, 'AUTH_UNAUTHORIZED');
    }

    if (profile.role !== 'admin' && profile.role !== 'superadmin') {
      return bookingError(
        requestId,
        'Email login is only available for admin and superadmin accounts.',
        403,
        'FORBIDDEN_ROLE'
      );
    }

    await assertActiveAdminTenantMembership(prisma, profile);

    const response = bookingSuccess(requestId, {
      session: {
        access_token: data.session.access_token,
        refresh_token: data.session.refresh_token,
        expires_at: data.session.expires_at,
        token_type: data.session.token_type,
      },
      profile,
    });

    const cookieOptions = {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax' as const,
      path: '/',
    };

    response.cookies.set('sb-access-token', data.session.access_token, {
      ...cookieOptions,
      maxAge: 60 * 60 * 24 * 7,
    });

    if (data.session.refresh_token) {
      response.cookies.set('sb-refresh-token', data.session.refresh_token, {
        ...cookieOptions,
        maxAge: 60 * 60 * 24 * 30,
      });
    }

    return response;
  } catch (error) {
    if (error instanceof Response) {
      return error;
    }

    if (
      error &&
      typeof error === 'object' &&
      'status' in error &&
      'code' in error &&
      'message' in error
    ) {
      return bookingErrorResponse(error, requestId);
    }

    const message =
      error instanceof Error ? error.message : 'Failed to contact authentication provider.';
    const isNetworkIssue =
      message.includes('ENOTFOUND') ||
      message.includes('fetch failed') ||
      message.includes('ECONNREFUSED') ||
      message.includes('ETIMEDOUT');

    return bookingError(
      requestId,
      isNetworkIssue
        ? 'Auth service is unreachable. Verify NEXT_PUBLIC_SUPABASE_URL and your network.'
        : 'Email sign-in failed.',
      isNetworkIssue ? 503 : 500,
      isNetworkIssue ? 'AUTH_UNAVAILABLE' : 'INTERNAL_ERROR'
    );
  }
}
