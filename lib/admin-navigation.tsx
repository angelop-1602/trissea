import type { ReactNode } from 'react';
import { BarChart3, Clock, DollarSign, MapPin, Settings, TrendingUp, Users } from 'lucide-react';
import type { TenantSettingsShape } from '@/lib/tenant-settings';

export interface AdminSidebarItem {
  label: string;
  icon: ReactNode;
  href?: string;
  badge?: string | number;
  items?: AdminSidebarItem[];
}

export function getAdminSidebarItems(options?: { pendingVerificationCount?: number }): AdminSidebarItem[] {
  return [
    { href: '/admin/dashboard', label: 'Dashboard', icon: <BarChart3 className="h-4 w-4" /> },
    { href: '/admin/terminals', label: 'TODAs', icon: <MapPin className="h-4 w-4" /> },
    {
      href: '/admin/drivers',
      label: 'Drivers',
      icon: <Users className="h-4 w-4" />,
      badge: options?.pendingVerificationCount && options.pendingVerificationCount > 0 ? options.pendingVerificationCount : undefined,
    },
    { href: '/admin/reservations', label: 'Reservations', icon: <Clock className="h-4 w-4" /> },
    { href: '/admin/rides', label: 'Trips', icon: <TrendingUp className="h-4 w-4" /> },
    { href: '/admin/team', label: 'Tenant Team', icon: <Users className="h-4 w-4" /> },
    { href: '/admin/reports', label: 'Reports', icon: <DollarSign className="h-4 w-4" /> },
    { href: '/admin/settings', label: 'Settings', icon: <Settings className="h-4 w-4" /> },
  ];
}

export function filterAdminSidebarItemsBySettings(
  items: AdminSidebarItem[],
  settings: TenantSettingsShape | null | undefined
) {
  if (!settings) {
    return items;
  }

  return items.filter((item) => {
    if (item.href === '/admin/reports') {
      return settings.moduleVisibility.reportsVisible;
    }

    if (item.href === '/admin/team') {
      return settings.moduleVisibility.tenantTeamVisible;
    }

    return true;
  });
}
