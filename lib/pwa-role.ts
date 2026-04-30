export const PWA_ROLE_STORAGE_KEY = 'mobility:pwa-role';

export const PWA_ROLE_LANDING_ROUTES = {
  passenger: '/passenger',
  driver: '/driver',
} as const;

export type PwaRole = keyof typeof PWA_ROLE_LANDING_ROUTES;

type ReadableStorage = Pick<Storage, 'getItem'> & Partial<Pick<Storage, 'setItem' | 'removeItem'>>;
type WritableStorage = Pick<Storage, 'setItem'> & Partial<Pick<Storage, 'removeItem'>>;
type RemovableStorage = Pick<Storage, 'removeItem'>;

export function isPwaRole(value: unknown): value is PwaRole {
  return value === 'passenger' || value === 'driver';
}

export function getPwaRoleLandingRoute(role: PwaRole): string {
  return PWA_ROLE_LANDING_ROUTES[role];
}

export function getPwaRoleFromPathname(pathname: string | null | undefined): PwaRole | null {
  if (!pathname) {
    return null;
  }

  if (pathname === '/passenger' || pathname.startsWith('/passenger/')) {
    return 'passenger';
  }

  if (pathname === '/driver' || pathname.startsWith('/driver/')) {
    return 'driver';
  }

  return null;
}

export function getPwaRoleFromSearchParams(searchParams: URLSearchParams): PwaRole | null {
  const appRole = searchParams.get('app') ?? searchParams.get('role');
  return isPwaRole(appRole) ? appRole : null;
}

function getBrowserStorage(): Storage | null {
  if (typeof window === 'undefined') {
    return null;
  }

  return window.localStorage;
}

export function readStoredPwaRole(storage: ReadableStorage | null = getBrowserStorage()): PwaRole | null {
  if (!storage) {
    return null;
  }

  try {
    const value = storage.getItem(PWA_ROLE_STORAGE_KEY);
    return isPwaRole(value) ? value : null;
  } catch {
    return null;
  }
}

export function writeStoredPwaRole(role: PwaRole, storage: WritableStorage | null = getBrowserStorage()) {
  if (!storage) {
    return;
  }

  try {
    storage.setItem(PWA_ROLE_STORAGE_KEY, role);
  } catch {
    // Storage can be blocked in privacy modes. The app should still install normally.
  }
}

export function clearStoredPwaRole(storage: RemovableStorage | null = getBrowserStorage()) {
  if (!storage) {
    return;
  }

  try {
    storage.removeItem(PWA_ROLE_STORAGE_KEY);
  } catch {
    // Ignore storage failures so launch routing remains best-effort.
  }
}
