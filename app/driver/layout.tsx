'use client';

import { usePathname } from 'next/navigation';
import { RoleGate } from '@/components/role-gate';

const DRIVER_PUBLIC_PATHS = new Set([
  '/driver',
  '/driver/login',
  '/driver/signup',
  '/driver/onboarding',
  '/driver/status',
]);

export default function DriverLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const pathname = usePathname();
  const normalizedPathname =
    pathname && pathname.length > 1 && pathname.endsWith('/') ? pathname.slice(0, -1) : pathname;

  if (normalizedPathname && DRIVER_PUBLIC_PATHS.has(normalizedPathname)) {
    return <>{children}</>;
  }

  return <RoleGate role="driver">{children}</RoleGate>;
}
