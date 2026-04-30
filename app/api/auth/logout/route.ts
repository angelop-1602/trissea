import { NextRequest } from 'next/server';
import { bookingSuccess, getRequestIdFromHeaders } from '@/lib/booking/http';
import { DEV_SMS_AUTH_COOKIE_NAME } from '@/lib/dev-sms-auth';

export async function POST(request: NextRequest) {
  const requestId = getRequestIdFromHeaders(request.headers);
  const response = bookingSuccess(requestId, { ok: true });

  response.cookies.set('sb-access-token', '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    expires: new Date(0),
    path: '/',
  });

  response.cookies.set('sb-refresh-token', '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    expires: new Date(0),
    path: '/',
  });

  response.cookies.set(DEV_SMS_AUTH_COOKIE_NAME, '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    expires: new Date(0),
    path: '/',
  });

  return response;
}
