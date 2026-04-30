import { randomUUID } from 'node:crypto';
import { NextRequest } from 'next/server';
import { z } from 'zod';
import { createSupabaseAdminClient, createSupabaseAnonServerClient } from '@/lib/supabase/server';
import { getPrisma } from '@/lib/prisma';
import { ensurePhoneE164Compatibility } from '@/lib/prisma-compat';
import { buildPhoneVariants, normalizePhoneE164 } from '@/lib/auth/phone';
import {
  bookingError,
  bookingSuccess,
  getRequestIdFromHeaders,
  rateLimitedResponse,
} from '@/lib/booking/http';
import { checkEndpointRateLimit } from '@/lib/security/rate-limit-endpoint';
import { BookingError } from '@/lib/booking/errors';
import { createDriverOnboardingDocuments, ensureDriverProfileForUser, type DriverOnboardingInput } from '@/lib/driver-domain';
import { resolveTenantByDriverLguCode } from '@/lib/tenant-context';
import { assertPhoneLoginOnlyAccess } from '@/lib/auth/phone-auth-flow';
import {
  DEV_SMS_AUTH_COOKIE_NAME,
  findDevSmsAuthUserByPhone,
  getDevSmsAuthCookieOptions,
  isDevSmsAuthOtp,
} from '@/lib/dev-sms-auth';

const bodySchema = z.object({
  phone: z.string().min(6),
  token: z.string().min(4),
  authFlow: z.enum(['login', 'signup']).optional(),
  expectedRole: z.enum(['passenger', 'driver']).optional(),
  signupRole: z.enum(['passenger', 'driver']).optional(),
  fullName: z.string().trim().min(2).optional(),
  emergencyName: z.string().trim().min(2).optional(),
  emergencyPhone: z.string().trim().min(6).optional(),
  acceptedTerms: z.boolean().optional(),
  lguCode: z.string().min(1).optional(),
  provinceCode: z.string().min(1).optional(),
  legalFullName: z.string().trim().min(2).optional(),
  email: z.string().trim().email().optional().or(z.literal('')),
  dateOfBirth: z.string().trim().optional(),
  homeAddress: z.string().trim().min(4).optional(),
  todaMembershipId: z.string().trim().optional(),
  licenseNumber: z.string().trim().min(4).optional(),
  licenseExpiry: z.string().trim().optional(),
  vehicleType: z.string().trim().optional(),
  plateNumber: z.string().trim().optional(),
  vehicleModel: z.string().trim().optional(),
  vehicleColor: z.string().trim().optional(),
});

function normalizeOptionalString(value?: string | null) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

export async function POST(request: NextRequest) {
  const requestId = getRequestIdFromHeaders(request.headers);
  const prisma = getPrisma();
  const json = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);

  if (!parsed.success) {
    return bookingError(requestId, 'Invalid request body.', 400, 'INVALID_REQUEST');
  }

  const normalizedInputPhone = normalizePhoneE164(parsed.data.phone);
  const authFlow = parsed.data.authFlow;
  const expectedRole = parsed.data.expectedRole;
  const signupRole = parsed.data.signupRole ?? 'passenger';
  const passengerFullName = normalizeOptionalString(parsed.data.fullName);
  const passengerEmail = normalizeOptionalString(parsed.data.email);
  const passengerEmergencyName = normalizeOptionalString(parsed.data.emergencyName);
  const passengerEmergencyPhoneInput = normalizeOptionalString(parsed.data.emergencyPhone);
  const hasPassengerSignupPayload =
    signupRole === 'passenger' &&
    Boolean(
      passengerFullName ||
        passengerEmail ||
        passengerEmergencyName ||
        passengerEmergencyPhoneInput ||
        parsed.data.acceptedTerms
    );
  const passengerTermsAcceptedAt = hasPassengerSignupPayload ? new Date() : null;
  let passengerEmergencyPhone: string | null = null;

  if (hasPassengerSignupPayload) {
    if (!passengerFullName) {
      return bookingError(requestId, 'Full name is required to complete passenger signup.', 400, 'INVALID_REQUEST');
    }

    if (!passengerEmergencyName || !passengerEmergencyPhoneInput) {
      return bookingError(
        requestId,
        'Emergency contact details are required to complete passenger signup.',
        400,
        'INVALID_REQUEST'
      );
    }

    if (parsed.data.acceptedTerms !== true) {
      return bookingError(
        requestId,
        'Terms acceptance is required to complete passenger signup.',
        400,
        'INVALID_REQUEST'
      );
    }

    passengerEmergencyPhone = normalizePhoneE164(passengerEmergencyPhoneInput);
  }

  const ipLimit = await checkEndpointRateLimit(request, {
    scope: 'auth.sms.verify.ip',
    limit: 40,
    windowMs: 10 * 60_000,
  });
  if (!ipLimit.allowed) {
    return rateLimitedResponse(requestId, ipLimit.retryAfterSeconds);
  }

  const phoneLimit = await checkEndpointRateLimit(request, {
    scope: 'auth.sms.verify.phone',
    limit: 10,
    windowMs: 10 * 60_000,
    keyParts: [normalizedInputPhone],
  });
  if (!phoneLimit.allowed) {
    return rateLimitedResponse(requestId, phoneLimit.retryAfterSeconds);
  }

  try {
    await ensurePhoneE164Compatibility(prisma);

    if (isDevSmsAuthOtp(normalizedInputPhone, parsed.data.token)) {
      const profile = await findDevSmsAuthUserByPhone(prisma, normalizedInputPhone);
      assertPhoneLoginOnlyAccess({
        flow: authFlow,
        expectedRole,
        existingRole: profile?.role ?? null,
      });

      if (!profile) {
        return bookingError(
          requestId,
          'This local test number is not linked to any existing account.',
          404,
          'PROFILE_NOT_FOUND'
        );
      }

      if (profile.role === 'admin' || profile.role === 'superadmin') {
        return bookingError(
          requestId,
          'Admin and superadmin accounts must sign in with email and password.',
          403,
          'FORBIDDEN_ROLE'
        );
      }

      if (parsed.data.signupRole && parsed.data.signupRole !== profile.role) {
        return bookingError(
          requestId,
          `This test number is already linked to a ${profile.role} account.`,
          409,
          'ROLE_MISMATCH'
        );
      }

      const response = bookingSuccess(requestId, {
        session: {
          access_token: null,
          refresh_token: null,
          expires_at: null,
          token_type: 'dev',
        },
        profile,
      });

      const cookieOptions = getDevSmsAuthCookieOptions();

      response.cookies.set(DEV_SMS_AUTH_COOKIE_NAME, profile.id, {
        ...cookieOptions,
        maxAge: 60 * 60 * 24 * 7,
      });
      response.cookies.set('sb-access-token', '', {
        ...cookieOptions,
        expires: new Date(0),
      });
      response.cookies.set('sb-refresh-token', '', {
        ...cookieOptions,
        expires: new Date(0),
      });

      return response;
    }

    const supabase = createSupabaseAnonServerClient();
    const { data, error } = await supabase.auth.verifyOtp({
      phone: normalizedInputPhone,
      token: parsed.data.token,
      type: 'sms',
    });

    if (error || !data.session || !data.user) {
      return bookingError(requestId, error?.message ?? 'OTP verification failed.', 400, 'INVALID_REQUEST');
    }

    const admin = createSupabaseAdminClient();
    const { data: userData, error: userError } = await admin.auth.getUser(data.session.access_token);

    if (userError || !userData.user) {
      return bookingError(requestId, 'Failed to load user.', 400, 'AUTH_UNAUTHORIZED');
    }

    const canonicalPhone = normalizePhoneE164(userData.user.phone ?? normalizedInputPhone);
    const phoneVariants = buildPhoneVariants(canonicalPhone, parsed.data.phone, normalizedInputPhone);
    let signupTenantId: string | null = null;
    let onboardingInput: DriverOnboardingInput | undefined;

    if (signupRole === 'driver') {
      const lguCode = parsed.data.lguCode?.trim() ?? parsed.data.provinceCode?.trim();
      if (!lguCode) {
        return bookingError(
          requestId,
          'LGU selection is required for driver registration.',
          400,
          'INVALID_REQUEST'
        );
      }

      const tenant = await resolveTenantByDriverLguCode(lguCode);
      if (!tenant) {
        return bookingError(
          requestId,
          'No tenant is configured for the selected LGU or its province fallback.',
          404,
          'TENANT_NOT_FOUND_FOR_LGU'
        );
      }

      signupTenantId = tenant.id;
      onboardingInput = {
        legalFullName: parsed.data.legalFullName,
        email: parsed.data.email,
        phone: canonicalPhone,
        dateOfBirth: parsed.data.dateOfBirth,
        homeAddress: parsed.data.homeAddress,
        todaMembershipId: parsed.data.todaMembershipId,
        licenseNumber: parsed.data.licenseNumber,
        licenseExpiry: parsed.data.licenseExpiry,
        vehicleType: parsed.data.vehicleType,
        plateNumber: parsed.data.plateNumber,
        vehicleModel: parsed.data.vehicleModel,
        vehicleColor: parsed.data.vehicleColor,
      };
    }

    const profile = await prisma.$transaction(async (tx) => {
      const assertSmsAuthRole = (role: string) => {
        if (role === 'admin' || role === 'superadmin') {
          throw new BookingError(
            'Admin and superadmin accounts must sign in with email and password.',
            403,
            'FORBIDDEN_ROLE'
          );
        }
      };

      const profileByPhoneE164 = await tx.user.findFirst({
        where: { phoneE164: canonicalPhone },
      });

      const profileBySupabase = await tx.user.findUnique({
        where: { supabaseId: userData.user.id },
      });

      if (profileByPhoneE164) {
        assertSmsAuthRole(profileByPhoneE164.role);
        assertPhoneLoginOnlyAccess({
          flow: authFlow,
          expectedRole,
          existingRole: profileByPhoneE164.role,
        });

        if (profileBySupabase && profileBySupabase.id !== profileByPhoneE164.id) {
          await tx.user.update({
            where: { id: profileBySupabase.id },
            data: {
              supabaseId: null,
              updatedAt: new Date(),
            },
          });
        }

        const updated = await tx.user.update({
          where: { id: profileByPhoneE164.id },
          data: {
            supabaseId: userData.user.id,
            phoneE164: canonicalPhone,
            name:
              signupRole === 'driver'
                ? parsed.data.legalFullName?.trim() || profileByPhoneE164.name
                : hasPassengerSignupPayload
                  ? passengerFullName ?? profileByPhoneE164.name
                  : profileByPhoneE164.name,
            email:
              signupRole === 'driver'
                ? parsed.data.email?.trim() || profileByPhoneE164.email
                : hasPassengerSignupPayload
                  ? passengerEmail
                  : profileByPhoneE164.email,
            emergencyContactName: hasPassengerSignupPayload
              ? passengerEmergencyName
              : profileByPhoneE164.emergencyContactName,
            emergencyContactPhone: hasPassengerSignupPayload
              ? passengerEmergencyPhone
              : profileByPhoneE164.emergencyContactPhone,
            termsAcceptedAt: hasPassengerSignupPayload
              ? passengerTermsAcceptedAt
              : profileByPhoneE164.termsAcceptedAt,
            tenantId: signupRole === 'driver' ? signupTenantId : profileByPhoneE164.tenantId,
            updatedAt: new Date(),
          },
        });

        if (signupRole === 'driver') {
          const driverProfile = await ensureDriverProfileForUser(tx, updated, onboardingInput);
          if (driverProfile) {
            await createDriverOnboardingDocuments(tx, driverProfile.id, onboardingInput ?? {});
          }
        }

        return updated;
      }

      if (profileBySupabase) {
        assertSmsAuthRole(profileBySupabase.role);
        assertPhoneLoginOnlyAccess({
          flow: authFlow,
          expectedRole,
          existingRole: profileBySupabase.role,
        });

        const updated = await tx.user.update({
          where: { id: profileBySupabase.id },
          data: {
            phoneE164: canonicalPhone,
            name:
              signupRole === 'driver'
                ? parsed.data.legalFullName?.trim() || profileBySupabase.name
                : hasPassengerSignupPayload
                  ? passengerFullName ?? profileBySupabase.name
                  : profileBySupabase.name,
            email:
              signupRole === 'driver'
                ? parsed.data.email?.trim() || profileBySupabase.email
                : hasPassengerSignupPayload
                  ? passengerEmail
                  : profileBySupabase.email,
            emergencyContactName: hasPassengerSignupPayload
              ? passengerEmergencyName
              : profileBySupabase.emergencyContactName,
            emergencyContactPhone: hasPassengerSignupPayload
              ? passengerEmergencyPhone
              : profileBySupabase.emergencyContactPhone,
            termsAcceptedAt: hasPassengerSignupPayload
              ? passengerTermsAcceptedAt
              : profileBySupabase.termsAcceptedAt,
            tenantId: signupRole === 'driver' ? signupTenantId : profileBySupabase.tenantId,
            updatedAt: new Date(),
          },
        });

        if (signupRole === 'driver') {
          const driverProfile = await ensureDriverProfileForUser(tx, updated, onboardingInput);
          if (driverProfile) {
            await createDriverOnboardingDocuments(tx, driverProfile.id, onboardingInput ?? {});
          }
        }

        return updated;
      }

      const legacyProfile = await tx.user.findFirst({
        where: {
          OR: [
            {
              phone: {
                in: phoneVariants,
              },
            },
            {
              phoneE164: {
                in: phoneVariants,
              },
            },
          ],
        },
        orderBy: { createdAt: 'asc' },
      });

      if (legacyProfile) {
        assertSmsAuthRole(legacyProfile.role);
        assertPhoneLoginOnlyAccess({
          flow: authFlow,
          expectedRole,
          existingRole: legacyProfile.role,
        });

        const updated = await tx.user.update({
          where: { id: legacyProfile.id },
          data: {
            supabaseId: userData.user.id,
            phoneE164: canonicalPhone,
            name:
              signupRole === 'driver'
                ? parsed.data.legalFullName?.trim() || legacyProfile.name
                : hasPassengerSignupPayload
                  ? passengerFullName ?? legacyProfile.name
                  : legacyProfile.name,
            email:
              signupRole === 'driver'
                ? parsed.data.email?.trim() || legacyProfile.email
                : hasPassengerSignupPayload
                  ? passengerEmail
                  : legacyProfile.email,
            emergencyContactName: hasPassengerSignupPayload
              ? passengerEmergencyName
              : legacyProfile.emergencyContactName,
            emergencyContactPhone: hasPassengerSignupPayload
              ? passengerEmergencyPhone
              : legacyProfile.emergencyContactPhone,
            termsAcceptedAt: hasPassengerSignupPayload
              ? passengerTermsAcceptedAt
              : legacyProfile.termsAcceptedAt,
            tenantId: signupRole === 'driver' ? signupTenantId : legacyProfile.tenantId,
            updatedAt: new Date(),
          },
        });

        if (signupRole === 'driver') {
          const driverProfile = await ensureDriverProfileForUser(tx, updated, onboardingInput);
          if (driverProfile) {
            await createDriverOnboardingDocuments(tx, driverProfile.id, onboardingInput ?? {});
          }
        }

        return updated;
      }

      assertPhoneLoginOnlyAccess({
        flow: authFlow,
        expectedRole,
        existingRole: null,
      });

      const created = await tx.user.create({
        data: {
          id: randomUUID(),
          supabaseId: userData.user.id,
          phone: canonicalPhone,
          phoneE164: canonicalPhone,
          name:
            signupRole === 'driver'
              ? parsed.data.legalFullName?.trim() || canonicalPhone
              : passengerFullName || canonicalPhone,
          email: signupRole === 'driver' ? parsed.data.email?.trim() || null : passengerEmail,
          emergencyContactName: hasPassengerSignupPayload ? passengerEmergencyName : null,
          emergencyContactPhone: hasPassengerSignupPayload ? passengerEmergencyPhone : null,
          termsAcceptedAt: hasPassengerSignupPayload ? passengerTermsAcceptedAt : null,
          role: signupRole,
          tenantId: signupTenantId,
          updatedAt: new Date(),
        },
      });

      if (signupRole === 'driver') {
        const driverProfile = await ensureDriverProfileForUser(tx, created, onboardingInput);
        if (driverProfile) {
          await createDriverOnboardingDocuments(tx, driverProfile.id, onboardingInput ?? {});
        }
      }

      return created;
    });

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

    response.cookies.set(DEV_SMS_AUTH_COOKIE_NAME, '', {
      ...cookieOptions,
      expires: new Date(0),
    });

    return response;
  } catch (error) {
    if (error instanceof BookingError) {
      return bookingError(requestId, error.message, error.status, error.code);
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
        : 'OTP verification failed.',
      isNetworkIssue ? 503 : 500,
      isNetworkIssue ? 'AUTH_UNAVAILABLE' : 'INTERNAL_ERROR'
    );
  }
}
