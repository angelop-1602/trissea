'use client';

import { Button } from '@/components/ui/button';

export function TenantSwitcher() {
  return (
    <Button variant="outline" size="sm" className="gap-2" disabled>
      Dev Tenant Switcher Disabled
    </Button>
  );
}
