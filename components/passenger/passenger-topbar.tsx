'use client';

import Link from 'next/link';
import { Compass, ShieldCheck } from 'lucide-react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { MobileUserTopbar } from '@/components/mobile-user-topbar';

interface PassengerTopbarProps {
  title: string;
  subtitle?: string;
  backHref?: string;
  topContext?: string;
  compact?: boolean;
  accountLabel: string;
  isAccountArea?: boolean;
  surface?: 'panel' | 'minimal';
}

export function PassengerTopbar({
  title,
  subtitle,
  backHref,
  topContext,
  compact = false,
  accountLabel,
  isAccountArea = false,
  surface = 'panel',
}: PassengerTopbarProps) {
  const ContextIcon = isAccountArea ? <ShieldCheck className="h-3.5 w-3.5" /> : <Compass className="h-3.5 w-3.5" />;
  const contextLabel = topContext ?? (isAccountArea ? 'Account' : 'Passenger');

  return (
    <MobileUserTopbar
      title={title}
      subtitle={subtitle}
      backHref={backHref}
      topContext={contextLabel}
      compact={compact}
      surface={surface}
      contextIcon={ContextIcon}
      trailing={
        <Link
          href="/passenger/account"
          aria-label="Open account"
        >
          <Avatar className={compact ? 'h-9 w-9 bg-primary/10' : 'h-10 w-10 bg-primary/10'}>
            <AvatarFallback className="bg-primary/10 font-semibold text-primary">
              {accountLabel}
            </AvatarFallback>
          </Avatar>
        </Link>
      }
    />
  );
}
