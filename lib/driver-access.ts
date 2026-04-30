export interface DriverAccessInput {
  role?: string | null;
  isDriverVerified?: boolean | null;
  isDriverRestricted?: boolean | null;
}

export type DriverAccessState = 'not-driver' | 'pending' | 'restricted' | 'active';

export function resolveDriverAccessState(input: DriverAccessInput): DriverAccessState {
  if (input.role !== 'driver') {
    return 'not-driver';
  }

  if (!input.isDriverVerified) {
    return 'pending';
  }

  if (input.isDriverRestricted) {
    return 'restricted';
  }

  return 'active';
}

export function driverNeedsStatusPage(input: DriverAccessInput): boolean {
  const state = resolveDriverAccessState(input);
  return state === 'pending' || state === 'restricted';
}
