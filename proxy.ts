import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { updateProxySession } from '@/lib/supabase/server-ssr';
import { createSupabaseAdminClient } from '@/lib/supabase/server';
import { DEV_SMS_AUTH_COOKIE_NAME, isDevSmsAuthEnabled } from '@/lib/dev-sms-auth';

const PROTECTED_PREFIXES = ['/passenger', '/driver', '/admin', '/superadmin'];
const PUBLIC_AUTH_PATHS = new Set([
  '/passenger',
  '/passenger/login',
  '/passenger/signup',
  '/passenger/signup/complete',
  '/driver',
  '/driver/login',
  '/driver/signup',
  '/driver/onboarding',
  '/driver/status',
]);

export async function proxy(request: NextRequest) {
  if (process.env.E2E_TEST_MODE === '1') {
    return NextResponse.next();
  }

  const { pathname } = request.nextUrl;
  const normalizedPathname =
    pathname.length > 1 && pathname.endsWith('/') ? pathname.slice(0, -1) : pathname;

  if (PUBLIC_AUTH_PATHS.has(normalizedPathname)) {
    return NextResponse.next();
  }

  const isProtected = PROTECTED_PREFIXES.some((prefix) => normalizedPathname.startsWith(prefix));
  if (!isProtected) {
    return NextResponse.next();
  }

  const { response, user } = await updateProxySession(request);

  const devUserId = isDevSmsAuthEnabled()
    ? request.cookies.get(DEV_SMS_AUTH_COOKIE_NAME)?.value?.trim()
    : null;

  if (!user && devUserId) {
    return response;
  }

  if (!user) {
    const legacyAccessToken = request.cookies.get('sb-access-token')?.value?.trim();
    if (legacyAccessToken) {
      const admin = createSupabaseAdminClient();
      const { data, error } = await admin.auth.getUser(legacyAccessToken);

      if (!error && data.user) {
        return response;
      }
    }

    const redirectTarget =
      normalizedPathname.startsWith('/admin') || normalizedPathname.startsWith('/superadmin')
        ? '/admin-login'
        : '/';
    const redirect = NextResponse.redirect(new URL(redirectTarget, request.url));
    redirect.cookies.delete('sb-access-token');
    redirect.cookies.delete('sb-refresh-token');
    return redirect;
  }

  return response;
}

export const config = {
  matcher: ['/passenger/:path*', '/driver/:path*', '/admin/:path*', '/superadmin/:path*'],
};
