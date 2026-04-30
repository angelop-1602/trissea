import { RoleGate } from '@/components/role-gate';

export default function AdminLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return <RoleGate role="admin">{children}</RoleGate>;
}
