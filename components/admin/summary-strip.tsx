import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface SummaryStripItem {
  label: string;
  value: ReactNode;
  meta?: ReactNode;
  icon?: ReactNode;
  emphasized?: boolean;
}

interface SummaryStripProps {
  items: SummaryStripItem[];
  className?: string;
}

export function SummaryStrip({ items, className }: SummaryStripProps) {
  return (
    <div className={cn('grid gap-3 md:grid-cols-2 xl:grid-cols-4', className)}>
      {items.map((item) => (
        <div
          key={item.label}
          className={cn(
            'rounded-2xl border px-4 py-4 shadow-[0_10px_30px_-24px_rgba(0,0,0,0.28)]',
            'border-border/70 bg-card/85 backdrop-blur-sm',
            item.emphasized && 'border-primary/20 bg-primary/[0.08] dark:bg-primary/[0.12]'
          )}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 space-y-1">
              <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
                {item.label}
              </p>
              <div className="text-2xl font-semibold tracking-tight text-foreground">{item.value}</div>
              {item.meta ? <div className="text-xs text-muted-foreground">{item.meta}</div> : null}
            </div>
            {item.icon ? <div className="shrink-0 text-primary/70">{item.icon}</div> : null}
          </div>
        </div>
      ))}
    </div>
  );
}
