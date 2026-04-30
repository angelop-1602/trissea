import * as React from 'react';
import { cn } from '@/lib/utils';

export function PassengerMetricPill({
  label,
  value,
  className,
}: {
  label: string;
  value: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'rounded-[1.2rem] border border-border/45 bg-background/42 px-3 py-3 text-center shadow-[inset_0_1px_0_rgba(255,255,255,0.02)]',
        className
      )}
    >
      <p className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">{label}</p>
      <div className="mt-1 text-sm font-medium">{value}</div>
    </div>
  );
}
