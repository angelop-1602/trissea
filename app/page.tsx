'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getHomeRouteForUser, getTenantSuspendedRoute } from '@/lib/role-routes';
import { MarketingLanding } from '@/components/landing/marketing-landing';
import {
  getPwaRoleFromSearchParams,
  getPwaRoleLandingRoute,
  readStoredPwaRole,
  writeStoredPwaRole,
} from '@/lib/pwa-role';

export default function HomePage() {
  const router = useRouter();

  useEffect(() => {
    let active = true;

    const loadProfile = async () => {
      const searchParams = new URLSearchParams(window.location.search);
      const shouldStayOnLanding = searchParams.get('chooseRole') === '1';
      const startupRole = getPwaRoleFromSearchParams(searchParams);
      if (startupRole) {
        writeStoredPwaRole(startupRole);
      }

      const response = await fetch('/api/me', { cache: 'no-store' });
      const payload = await response.json().catch(() => ({}));

      if (!active) {
        return;
      }

      if (!response.ok && payload.code === 'TENANT_SUSPENDED') {
        router.replace(
          getTenantSuspendedRoute({
            role: payload.user?.role ?? null,
            message: typeof payload.error === 'string' ? payload.error : null,
          })
        );
        return;
      }

      if (!response.ok || !payload.user?.role) {
        if (!shouldStayOnLanding && (response.status === 401 || response.status === 404)) {
          const storedRole = startupRole ?? readStoredPwaRole();
          if (storedRole) {
            router.replace(getPwaRoleLandingRoute(storedRole));
          }
        }
        return;
      }

      router.replace(getHomeRouteForUser(payload.user, payload.transportModules));
    };

    void loadProfile();

    return () => {
      active = false;
    };
  }, [router]);

  return <MarketingLanding />;
}
