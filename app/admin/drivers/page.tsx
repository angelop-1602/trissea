'use client';

import { AdminDriverDirectory } from '@/components/admin/driver-directory';
import { useStore } from '@/lib/store-context';

export default function AdminDriversPage() {
  const { currentTenantSettings } = useStore();

  return <AdminDriverDirectory source={currentTenantSettings?.operationsPreferences.driversDefaultTab ?? 'verified'} />;
}
