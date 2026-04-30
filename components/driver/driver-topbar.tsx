'use client';

import Link from 'next/link';
import { useMemo } from 'react';
import { usePathname } from 'next/navigation';
import { Route, ShieldCheck } from 'lucide-react';
import { MobileUserTopbar } from '@/components/mobile-user-topbar';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { useStore } from '@/lib/store-context';

function getInitials(value?: string | null) {
  if (!value?.trim()) {
    return 'D';
  }

  const parts = value.trim().split(/\s+/).filter(Boolean).slice(0, 2);

  return parts.map((part) => part[0]?.toUpperCase() ?? '').join('') || 'D';
}

interface DriverTopbarProps {
  title?: string;
  subtitle?: string;
  backHref?: string;
  topContext?: string;
  compact?: boolean;
  surface?: 'panel' | 'minimal';
}

export function DriverTopbar({
  backHref,
  topContext = 'Driver',
  compact = true,
  surface = 'minimal',
}: DriverTopbarProps) {
  const pathname = usePathname();
  const { currentUser } = useStore();
  const isAccountArea = pathname.startsWith('/driver/account');
  const accountLabel = useMemo(
    () => getInitials(currentUser?.name),
    [currentUser?.name],
  );

  return (
    <MobileUserTopbar
      backHref={backHref}
      topContext={topContext}
      compact={compact}
      surface={surface}
      contextIcon={
        isAccountArea ? (
          <ShieldCheck className="h-3.5 w-3.5" />
        ) : (
          <Route className="h-3.5 w-3.5" />
        )
      }
      trailing={
        <Link
          href="/driver/account"
          aria-label="Open driver account"
        >
          <Avatar className="h-9 w-9 bg-primary/10">
            <AvatarFallback className="bg-primary/10 font-semibold text-primary">
              {accountLabel}
            </AvatarFallback>
          </Avatar>
        </Link>
      }
    />
  );
}
