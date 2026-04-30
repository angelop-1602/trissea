'use client';

import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export interface DriverProfileDetailItem {
  label: string;
  value: ReactNode;
}

interface DriverProfileDetailGroupProps {
  title: string;
  description?: string;
  items?: DriverProfileDetailItem[];
  emptyState?: ReactNode;
  columns?: 1 | 2;
  className?: string;
  listClassName?: string;
}

export function DriverProfileDetailGroup({
  title,
  description,
  items = [],
  emptyState,
  columns = 1,
  className,
  listClassName,
}: DriverProfileDetailGroupProps) {
  return (
    <section className={cn('space-y-4', className)}>
      <div className="space-y-1">
        <h2 className="text-sm font-semibold text-foreground">{title}</h2>
        {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
      </div>

      {items.length > 0 ? (
        <dl
          className={cn(
            'grid gap-x-6 gap-y-4',
            columns === 2 ? 'sm:grid-cols-2' : 'grid-cols-1',
            listClassName
          )}
        >
          {items.map((item) => (
            <div key={item.label} className="space-y-1">
              <dt className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                {item.label}
              </dt>
              <dd className="text-sm font-medium leading-relaxed text-foreground break-words">
                {item.value}
              </dd>
            </div>
          ))}
        </dl>
      ) : emptyState ? (
        <p className="text-sm text-muted-foreground">{emptyState}</p>
      ) : null}
    </section>
  );
}
