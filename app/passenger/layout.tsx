'use client';

import { usePathname } from 'next/navigation';
import { RoleGate } from '@/components/role-gate';

const PASSENGER_PUBLIC_PATHS = new Set([
  '/passenger',
  '/passenger/login',
  '/passenger/signup',
  '/passenger/signup/complete',
]);

export default function PassengerLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const pathname = usePathname();
  const normalizedPathname =
    pathname && pathname.length > 1 && pathname.endsWith('/') ? pathname.slice(0, -1) : pathname;

  if (normalizedPathname && PASSENGER_PUBLIC_PATHS.has(normalizedPathname)) {
    return <>{children}</>;
  }

  return <RoleGate role="passenger">{children}</RoleGate>;
}
