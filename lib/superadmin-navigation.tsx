import { BarChart3, Building2, Settings, TrendingUp, UserRound } from 'lucide-react';
import type { AdminSidebarItem } from '@/lib/admin-navigation';

export function getSuperadminSidebarItems(): AdminSidebarItem[] {
  return [
    { href: '/superadmin/dashboard', label: 'Dashboard', icon: <BarChart3 className="h-4 w-4" /> },
    { href: '/superadmin/tenants', label: 'Tenants', icon: <Building2 className="h-4 w-4" /> },
    { href: '/superadmin/passengers', label: 'Passengers', icon: <UserRound className="h-4 w-4" /> },
    { href: '/superadmin/reports', label: 'Reports', icon: <TrendingUp className="h-4 w-4" /> },
    { href: '/superadmin/settings', label: 'Settings', icon: <Settings className="h-4 w-4" /> },
  ];
}
