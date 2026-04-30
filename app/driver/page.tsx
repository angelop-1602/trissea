import type { Metadata } from 'next';
import { RoleOnboardingFlow } from '@/components/auth/role-onboarding-flow';
import { BRAND_NAME, DRIVER_APP_NAME } from '@/lib/brand';
import { ROLE_ONBOARDING } from '@/lib/role-onboarding';

export const metadata: Metadata = {
  title: `Driver onboarding | ${BRAND_NAME}`,
  description: `Apply as a ${BRAND_NAME} driver and prepare your profile for tenant admin review.`,
  manifest: '/manifest-driver.webmanifest',
  appleWebApp: {
    capable: true,
    title: DRIVER_APP_NAME,
    statusBarStyle: 'default',
  },
};

export default function DriverOnboardingEntryPage() {
  return <RoleOnboardingFlow config={ROLE_ONBOARDING.driver} />;
}
