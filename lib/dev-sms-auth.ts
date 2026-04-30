import type { PrismaClient } from '@prisma/client';
import { buildPhoneVariants, normalizePhoneE164 } from '@/lib/auth/phone';

export const DEV_SMS_AUTH_COOKIE_NAME = 'trissea-dev-user-id';

const DEFAULT_DEV_SMS_AUTH_PHONE = '+639455200000';
const DEFAULT_DEV_SMS_AUTH_TOKEN = '321321';

function normalizeConfiguredPhone(phone: string) {
  return normalizePhoneE164(phone.trim());
}

function normalizeConfiguredPhoneList(phones: string) {
  return phones
    .split(',')
    .map((phone) => phone.trim())
    .filter((phone) => phone.length > 0)
    .map(normalizeConfiguredPhone);
}

export function isDevSmsAuthEnabled() {
  return process.env.NODE_ENV !== 'production';
}

export function getDevSmsAuthPhone() {
  return normalizeConfiguredPhone(process.env.DEV_SMS_AUTH_PHONES ?? DEFAULT_DEV_SMS_AUTH_PHONE);
}

export function getDevSmsAuthPhones() {
  const configuredPhones = process.env.DEV_SMS_AUTH_PHONES?.trim();

  if (configuredPhones) {
    return Array.from(new Set(normalizeConfiguredPhoneList(configuredPhones)));
  }

  const configuredPhone = process.env.DEV_SMS_AUTH_PHONES?.trim();
  if (configuredPhone) {
    return [normalizeConfiguredPhone(configuredPhone)];
  }

  return [DEFAULT_DEV_SMS_AUTH_PHONE];
}

export function getDevSmsAuthToken() {
  const token = process.env.DEV_SMS_AUTH_TOKEN?.trim();
  return token && token.length > 0 ? token : DEFAULT_DEV_SMS_AUTH_TOKEN;
}

export function isDevSmsAuthPhone(phone: string) {
  if (!isDevSmsAuthEnabled()) {
    return false;
  }

  try {
    return getDevSmsAuthPhones().includes(normalizePhoneE164(phone));
  } catch {
    return false;
  }
}

export function isDevSmsAuthOtp(phone: string, token: string) {
  return isDevSmsAuthPhone(phone) && token.trim() === getDevSmsAuthToken();
}

export function getDevSmsAuthCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: '/',
  };
}

export async function findDevSmsAuthUserByPhone(prisma: PrismaClient, phone: string) {
  const normalizedPhone = normalizePhoneE164(phone);
  const phoneVariants = buildPhoneVariants(normalizedPhone, phone, normalizedPhone);

  return prisma.user.findFirst({
    where: {
      OR: [
        {
          phoneE164: {
            in: phoneVariants,
          },
        },
        {
          phone: {
            in: phoneVariants,
          },
        },
      ],
    },
    orderBy: { createdAt: 'asc' },
  });
}
