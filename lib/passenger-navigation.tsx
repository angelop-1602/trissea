import { Clock3, History, House, LayoutGrid, MapPinned, QrCode } from 'lucide-react';

export interface PassengerNavItem {
  href: string;
  label: string;
  icon: React.ReactNode;
  matchPaths?: string[];
  isPrimaryAction?: boolean;
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
      href: '/passenger/scan',
      label: 'Scan',
      icon: <QrCode className="h-5 w-5" />,
    },
    {
      href: '/passenger/on-demand',
      label: 'Book',
      icon: <MapPinned className="h-5 w-5" />,
      isPrimaryAction: true,
    },
    {
      href: '/passenger/activity',
      label: 'Activity',
      icon: <History className="h-5 w-5" />,
    },
    {
      href: '/passenger/toda',
      label: 'TODA',
      icon: <Clock3 className="h-5 w-5" />,
    },
  ];
}

export const PASSENGER_PRIMARY_NAV = getPassengerPrimaryNav();
