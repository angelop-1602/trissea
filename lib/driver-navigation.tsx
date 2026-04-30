import { Activity, ClipboardList, Clock3, House, LayoutGrid, Route } from 'lucide-react';

export interface DriverPrimaryNavItem {
  href: string;
  label: string;
  icon: React.ReactNode;
  matchPaths?: string[];
}

export interface DriverHeaderMeta {
  title: string;
  subtitle: string;
  topContext: string;
}

export function getDriverPrimaryNav(options?: { hasModuleHub?: boolean }): DriverPrimaryNavItem[] {
  return [
    options?.hasModuleHub
      ? {
          href: '/driver/modules',
          label: 'Modules',
          icon: <LayoutGrid className="h-5 w-5" />,
        }
      : {
          href: '/driver/tricycle',
          label: 'Home',
          icon: <House className="h-5 w-5" />,
          matchPaths: ['/driver/tricycle', '/driver/dashboard'],
        },
    {
      href: '/driver/assigned',
      label: 'Assigned',
      icon: <ClipboardList className="h-5 w-5" />,
      matchPaths: ['/driver/assigned', '/driver/offers'],
    },
    {
      href: '/driver/active-trip',
      label: 'Active',
      icon: <Route className="h-5 w-5" />,
    },
    {
      href: '/driver/activity',
      label: 'Activity',
      icon: <Activity className="h-5 w-5" />,
      matchPaths: ['/driver/activity', '/driver/history', '/driver/earnings'],
    },
  ];
}

export const DRIVER_PRIMARY_NAV = getDriverPrimaryNav();

const DRIVER_HEADER_META: Array<{
  matchPaths: string[];
  meta: DriverHeaderMeta;
}> = [
  {
    matchPaths: ['/driver/modules'],
    meta: {
      title: 'Modules',
      subtitle: 'Choose which transport workspace to open from the driver app.',
      topContext: 'Modules',
    },
  },
  {
    matchPaths: ['/driver/tricycle', '/driver/dashboard'],
    meta: {
      title: 'Home',
      subtitle: 'Duty state, assigned work, and TODA context in one place.',
      topContext: 'Home',
    },
  },
  {
    matchPaths: ['/driver/assigned', '/driver/offers'],
    meta: {
      title: 'Assigned',
      subtitle: 'Review matched rides and stay ready for the next dispatch.',
      topContext: 'Assigned',
    },
  },
  {
    matchPaths: ['/driver/active-trip'],
    meta: {
      title: 'Active',
      subtitle: 'Follow the live trip flow and update each ride stage.',
      topContext: 'Active',
    },
  },
  {
    matchPaths: ['/driver/activity'],
    meta: {
      title: 'Activity',
      subtitle:
        'Review work history and fare totals from the same activity log.',
      topContext: 'Activity',
    },
  },
  {
    matchPaths: ['/driver/history'],
    meta: {
      title: 'Ride History',
      subtitle:
        'Completed and cancelled ride records linked to your driver account.',
      topContext: 'Activity',
    },
  },
  {
    matchPaths: ['/driver/earnings'],
    meta: {
      title: 'Earnings',
      subtitle: 'Track completed trip fares and lifetime earnings totals.',
      topContext: 'Activity',
    },
  },
  {
    matchPaths: ['/driver/jeepney'],
    meta: {
      title: 'Jeepney',
      subtitle: 'The jeepney driver workspace is being prepared as a separate module.',
      topContext: 'Jeepney',
    },
  },
  {
    matchPaths: ['/driver/toda'],
    meta: {
      title: 'Terminal Board',
      subtitle:
        'Monitor assigned-terminal requests first, with tenant dispatch context when needed.',
      topContext: 'TODA',
    },
  },
];

export function isPathInNavItem(
  pathname: string,
  item: Pick<DriverPrimaryNavItem, 'href' | 'matchPaths'>,
) {
  const candidates = item.matchPaths?.length ? item.matchPaths : [item.href];
  return candidates.some(
    (path) => pathname === path || pathname.startsWith(`${path}/`),
  );
}

export function getDriverHeaderMeta(pathname: string): DriverHeaderMeta {
  const matched = DRIVER_HEADER_META.find((entry) =>
    entry.matchPaths.some(
      (path) => pathname === path || pathname.startsWith(`${path}/`),
    ),
  );

  return (
    matched?.meta ?? {
      title: 'Driver',
      subtitle:
        'Driver operations for assigned work, live trips, and activity.',
      topContext: 'Driver',
    }
  );
}
