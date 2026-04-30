import { NextRequest } from 'next/server';
import { z } from 'zod';
import { createSupabaseAnonServerClient } from '@/lib/supabase/server';
import { normalizePhoneE164 } from '@/lib/auth/phone';
import {
  bookingError,
  bookingSuccess,
  getRequestIdFromHeaders,
  rateLimitedResponse,
} from '@/lib/booking/http';
import { checkEndpointRateLimit } from '@/lib/security/rate-limit-endpoint';
import { isDevSmsAuthPhone } from '@/lib/dev-sms-auth';

const bodySchema = z.object({
  phone: z.string().min(6),
});

function isUnverifiedTwilioTrialDestination(message: string) {
  const normalized = message.toLowerCase();
  return (
    normalized.includes('21608') ||
    (normalized.includes('trial accounts') && normalized.includes('unverified')) ||
    normalized.includes('phone number is unverified')
  );
}

export async function POST(request: NextRequest) {
  const requestId = getRequestIdFromHeaders(request.headers);
  const json = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);

  if (!parsed.success) {
    return bookingError(requestId, 'Invalid request body.', 400, 'INVALID_REQUEST');
  }

  try {
    const normalizedPhone = normalizePhoneE164(parsed.data.phone);

    const ipLimit = await checkEndpointRateLimit(request, {
      scope: 'auth.sms.send.ip',
      limit: 20,
      windowMs: 10 * 60_000,
    });
    if (!ipLimit.allowed) {
      return rateLimitedResponse(requestId, ipLimit.retryAfterSeconds);
    }

    const phoneLimit = await checkEndpointRateLimit(request, {
      scope: 'auth.sms.send.phone',
      limit: 5,
      windowMs: 10 * 60_000,
      keyParts: [normalizedPhone],
    });
    if (!phoneLimit.allowed) {
      return rateLimitedResponse(requestId, phoneLimit.retryAfterSeconds);
    }

    if (isDevSmsAuthPhone(normalizedPhone)) {
      return bookingSuccess(requestId, { ok: true });
    }

    const supabase = createSupabaseAnonServerClient();
    const { error } = await supabase.auth.signInWithOtp({
      phone: normalizedPhone,
      options: {
        shouldCreateUser: true,
      },
    });

    if (error) {
      if (isUnverifiedTwilioTrialDestination(error.message)) {
        return bookingError(
          requestId,
          'SMS OTP could not be sent because your Twilio account is still in trial mode. Trial mode only sends to phone numbers verified in Twilio, so fictional seeded numbers will not receive codes.',
          400,
          'SMS_DESTINATION_UNVERIFIED'
        );
      }

      return bookingError(requestId, error.message, 400, 'INVALID_REQUEST');
    }

    return bookingSuccess(requestId, { ok: true });
  } catch (error) {
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
        : 'Failed to send OTP.',
      isNetworkIssue ? 503 : 500,
      isNetworkIssue ? 'AUTH_UNAVAILABLE' : 'INTERNAL_ERROR'
    );
  }
}
