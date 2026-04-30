import type { UserRole } from '@prisma/client';
import { BookingError } from '@/lib/booking/errors';

export type PhoneAuthFlow = 'login' | 'signup';
export type PhoneAuthExpectedRole = 'passenger' | 'driver';

function getNoAccountMessage(expectedRole?: PhoneAuthExpectedRole) {
  if (expectedRole === 'driver') {
    return 'No driver account is linked to this mobile number yet. Create a driver account first.';
  }

  if (expectedRole === 'passenger') {
    return 'No passenger account is linked to this mobile number yet. Create a passenger account first.';
  }

  return 'No account is linked to this mobile number yet.';
}

function getRoleMismatchMessage(expectedRole: PhoneAuthExpectedRole, existingRole: UserRole) {
  if (expectedRole === 'driver' && existingRole === 'passenger') {
    return 'This mobile number is not linked to a driver account.';
  }

  if (expectedRole === 'passenger' && existingRole === 'driver') {
    return 'This mobile number is not linked to a passenger account.';
  }

  return `This mobile number is already linked to a ${existingRole} account.`;
}

export function assertPhoneLoginOnlyAccess(input: {
  flow?: PhoneAuthFlow;
  expectedRole?: PhoneAuthExpectedRole;
  existingRole?: UserRole | null;
}) {
  if (input.flow !== 'login') {
    return;
  }

  if (!input.existingRole) {
    throw new BookingError(getNoAccountMessage(input.expectedRole), 404, 'PROFILE_NOT_FOUND');
  }

  if (input.existingRole === 'admin' || input.existingRole === 'superadmin') {
    throw new BookingError(
      'Admin and superadmin accounts must sign in with email and password.',
      403,
      'FORBIDDEN_ROLE'
    );
  }

  if (input.expectedRole && input.existingRole !== input.expectedRole) {
    throw new BookingError(
      getRoleMismatchMessage(input.expectedRole, input.existingRole),
      409,
      'ROLE_MISMATCH'
    );
  }
}
