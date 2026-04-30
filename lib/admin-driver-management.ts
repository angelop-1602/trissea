export type AdminDriverListSource = 'verified' | 'unverified' | 'restricted';

export interface AdminDriverDirectoryItem {
  id: string;
  driverProfileId?: string;
  name: string;
  email: string | null;
  phone: string | null;
  todaName?: string | null;
  verificationStatus?: 'pending' | 'verified';
  restrictionStatus?: 'unrestricted' | 'restricted';
  operationalState?: 'pending_review' | 'offline' | 'online' | 'restricted';
  isDriverVerified: boolean;
  isDriverRestricted: boolean;
  rating: number | null;
  completedRides: number | null;
  createdAt: string | Date;
  DriverPresence: {
    isOnline: boolean;
    onlineSinceAt: string | Date | null;
    lastHeartbeatAt: string | Date | null;
  } | null;
}

export function normalizeAdminDriverListSource(value?: string | null): AdminDriverListSource {
  if (value === 'unverified') {
    return 'unverified';
  }

  if (value === 'restricted') {
    return 'restricted';
  }

  return 'verified';
}

export function getAdminDriverListHref(source: AdminDriverListSource): string {
  if (source === 'unverified') {
    return '/admin/drivers/unverified';
  }

  if (source === 'restricted') {
    return '/admin/drivers/restricted';
  }

  return '/admin/drivers';
}

export function isOperationalDriverOnline(driver: Pick<AdminDriverDirectoryItem, 'isDriverVerified' | 'isDriverRestricted' | 'DriverPresence'>): boolean {
  return driver.isDriverVerified && !driver.isDriverRestricted && Boolean(driver.DriverPresence?.isOnline);
}

export function computeAdminDriverStats(
  drivers: Array<Pick<AdminDriverDirectoryItem, 'isDriverVerified' | 'isDriverRestricted' | 'rating' | 'DriverPresence'>>
) {
  const verifiedDrivers = drivers.filter((driver) => driver.isDriverVerified).length;
  const pendingVerification = drivers.length - verifiedDrivers;
  const restrictedDrivers = drivers.filter((driver) => driver.isDriverVerified && driver.isDriverRestricted).length;
  const activeToday = drivers.filter((driver) => isOperationalDriverOnline(driver)).length;
  const averageRating =
    drivers.length === 0
      ? 0
      : drivers.reduce((sum, driver) => sum + (driver.rating ?? 0), 0) / drivers.length;

  return {
    totalDrivers: drivers.length,
    verifiedDrivers,
    pendingVerification,
    restrictedDrivers,
    activeToday,
    averageRating,
  };
}

export function filterAdminDriversBySource<T extends Pick<AdminDriverDirectoryItem, 'isDriverVerified' | 'isDriverRestricted'>>(
  drivers: T[],
  source: AdminDriverListSource
): T[] {
  return drivers.filter((driver) => {
    if (source === 'unverified') {
      return !driver.isDriverVerified;
    }

    if (source === 'restricted') {
      return driver.isDriverVerified && 'isDriverRestricted' in driver && Boolean(driver.isDriverRestricted);
    }

    return driver.isDriverVerified && (!('isDriverRestricted' in driver) || !driver.isDriverRestricted);
  });
}

export function matchesAdminDriverSearch(
  driver: Pick<
    AdminDriverDirectoryItem,
    'id' | 'name' | 'email' | 'phone' | 'isDriverVerified' | 'isDriverRestricted' | 'DriverPresence'
  >,
  query: string
): boolean {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) {
    return true;
  }

  const statusTerms = [
    driver.isDriverVerified ? 'verified approved' : 'pending unverified review',
    driver.isDriverRestricted ? 'restricted' : '',
    isOperationalDriverOnline(driver) ? 'online live active' : 'offline idle',
  ];

  return [driver.name, driver.phone ?? '', driver.email ?? '', driver.id, ...statusTerms]
    .join(' ')
    .toLowerCase()
    .includes(normalizedQuery);
}
