import type { UserRole } from '@prisma/client';
import { driverNeedsStatusPage } from '@/lib/driver-access';
import {
  getDefaultTransportModule,
  getModuleHubRouteForRole,
  getModuleLandingRouteForRole,
  hasModuleHub,
  type TenantTransportModuleSummary,
} from '@/lib/transport-modules';

export const ROLE_HOME_ROUTE: Record<UserRole, string> = {
  passenger: '/passenger/tricycle',
  driver: '/driver/tricycle',
  admin: '/admin/tricycle',
  superadmin: '/superadmin/dashboard',
};

export function getHomeRouteForRole(role: UserRole): string {
  return ROLE_HOME_ROUTE[role];
}

export function getHomeRouteForUser(user: {
  role: UserRole;
  isDriverVerified?: boolean | null;
  isDriverRestricted?: boolean | null;
}, transportModules?: TenantTransportModuleSummary[]): string {
  if (driverNeedsStatusPage(user)) {
    return '/driver/status';
  }

  if (user.role === 'passenger' || user.role === 'driver' || user.role === 'admin') {
    if (hasModuleHub(transportModules)) {
      return getModuleHubRouteForRole(user.role);
    }

    const defaultModule = getDefaultTransportModule(transportModules);
    if (defaultModule) {
      return getModuleLandingRouteForRole(user.role, defaultModule.moduleKey);
    }
  }

  return getHomeRouteForRole(user.role);
}

export function getAuthEntryRouteForRole(role: UserRole): string {
  switch (role) {
    case 'passenger':
      return '/passenger/login';
    case 'driver':
      return '/driver/login';
    case 'admin':
    case 'superadmin':
      return '/admin-login';
  }
}

export function getAuthEntryRouteForCurrentUser(role?: UserRole | null): string {
  if (!role) {
    return '/';
  }

  return getAuthEntryRouteForRole(role);
}

export function getTenantSuspendedRoute(params?: {
  role?: UserRole | null;
  message?: string | null;
}) {
  const search = new URLSearchParams();
  if (params?.role) {
    search.set('role', params.role);
  }
  if (params?.message) {
    search.set('message', params.message);
  }

  const query = search.toString();
  return `/tenant-suspended${query ? `?${query}` : ''}`;
}
