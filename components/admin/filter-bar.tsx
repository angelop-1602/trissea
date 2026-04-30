import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface FilterBarProps {
  children: ReactNode;
  className?: string;
}

export function FilterBar({ children, className }: FilterBarProps) {
  return (
    <div
      className={cn(
        'rounded-2xl border border-border/70 bg-card/80 px-4 py-4 shadow-[0_10px_30px_-24px_rgba(0,0,0,0.28)] backdrop-blur-sm',
        className
      )}
    >
      {children}
    </div>
  );
}
