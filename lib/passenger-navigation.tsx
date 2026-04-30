import { Clock3, History, House, LayoutGrid, UserRound } from 'lucide-react';

export interface PassengerNavItem {
  href: string;
  label: string;
  icon: React.ReactNode;
  matchPaths?: string[];
}

export function getPassengerPrimaryNav(options?: { hasModuleHub?: boolean }): PassengerNavItem[] {
  return [
    options?.hasModuleHub
      ? {
          href: '/passenger/modules',
          label: 'Modules',
          icon: <LayoutGrid className="h-5 w-5" />,
        }
      : {
          href: '/passenger/home',
          label: 'Home',
          icon: <House className="h-5 w-5" />,
          matchPaths: ['/passenger/tricycle', '/passenger/home'],
        },
    {
      href: '/passenger/activity',
      label: 'Trips',
      icon: <History className="h-5 w-5" />,
    },
    {
      href: '/passenger/toda',
      label: 'Terminals',
      icon: <Clock3 className="h-5 w-5" />,
    },
    {
      href: '/passenger/account',
      label: 'Profile',
      icon: <UserRound className="h-5 w-5" />,
    },
  ];
}

export const PASSENGER_PRIMARY_NAV = getPassengerPrimaryNav();
