'use client';

import { ReactNode, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { PageHeaderSkeleton, StatsCardsSkeleton, TableCardSkeleton } from '@/components/dashboard/loading-skeletons';
import { PageLoadingState } from '@/components/page-state';
import { getAuthEntryRouteForRole, getHomeRouteForUser, getTenantSuspendedRoute } from '@/lib/role-routes';
import type { UserRole } from '@prisma/client';
import { useStore } from '@/lib/store-context';
import { driverNeedsStatusPage } from '@/lib/driver-access';

interface RoleGateProps {
  role: UserRole;
  children: ReactNode;
}

export function RoleGate({ role, children }: RoleGateProps) {
  const router = useRouter();
  const {
    setCurrentTenant,
    setCurrentTenantModules,
    setCurrentTenantPermissions,
    setCurrentTenantSettings,
    setCurrentUser,
  } = useStore();
  const [isAllowed, setIsAllowed] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let active = true;

    const loadProfile = async () => {
      const response = await fetch('/api/me', { cache: 'no-store' });
      const payload = await response.json().catch(() => ({}));

      if (!active) {
        return;
      }

      if (!response.ok && payload.code === 'TENANT_SUSPENDED') {
        router.replace(
          getTenantSuspendedRoute({
            role,
            message: typeof payload.error === 'string' ? payload.error : null,
          })
        );
        return;
      }

      if (!response.ok || !payload.user?.role) {
        router.replace(getAuthEntryRouteForRole(role));
        return;
      }

      if (payload.user.role !== role) {
        router.replace(getHomeRouteForUser(payload.user, payload.transportModules));
        return;
      }

      if (role === 'driver' && driverNeedsStatusPage(payload.user)) {
        router.replace('/driver/status');
        return;
      }

      setCurrentUser(payload.user);
      setCurrentTenant(payload.tenant ?? null);
      setCurrentTenantSettings(payload.tenantSettings ?? null);
      setCurrentTenantModules(payload.transportModules ?? []);
      setCurrentTenantPermissions(payload.permissions ?? []);
      setIsAllowed(true);
      setIsLoading(false);
    };

    void loadProfile();

    return () => {
      active = false;
    };
  }, [role, router, setCurrentTenant, setCurrentTenantModules, setCurrentTenantPermissions, setCurrentTenantSettings, setCurrentUser]);

  if (isLoading || !isAllowed) {
    if (role === 'passenger' || role === 'driver') {
      return <PageLoadingState label={`Loading ${role} workspace...`} tone={role} />;
    }

    return (
      <div className="space-y-6 p-6">
        <PageHeaderSkeleton />
        <StatsCardsSkeleton count={4} />
        <TableCardSkeleton columnCount={4} />
      </div>
    );
  }

  return <>{children}</>;
}
