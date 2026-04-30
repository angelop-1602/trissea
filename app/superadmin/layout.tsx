import { RoleGate } from '@/components/role-gate';

export default function SuperadminLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return <RoleGate role="superadmin">{children}</RoleGate>;
}
