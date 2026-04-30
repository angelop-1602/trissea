import type { Metadata } from 'next';
import { RoleOnboardingFlow } from '@/components/auth/role-onboarding-flow';
import { BRAND_NAME, PASSENGER_APP_NAME } from '@/lib/brand';
import { ROLE_ONBOARDING } from '@/lib/role-onboarding';

export const metadata: Metadata = {
  title: `Passenger onboarding | ${BRAND_NAME}`,
  description: `Create a ${BRAND_NAME} passenger account to book trips, manage reservations, and track your ride.`,
  manifest: '/manifest-passenger.webmanifest',
  appleWebApp: {
    capable: true,
    title: PASSENGER_APP_NAME,
    statusBarStyle: 'default',
  },
};

export default function PassengerOnboardingPage() {
  return <RoleOnboardingFlow config={ROLE_ONBOARDING.passenger} />;
}
