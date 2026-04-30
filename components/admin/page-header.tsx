import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface PageHeaderProps {
  title: string;
  description?: ReactNode;
  eyebrow?: string;
  actions?: ReactNode;
  className?: string;
  contentClassName?: string;
}

export function PageHeader({
  title,
  description,
  eyebrow,
  actions,
  className,
  contentClassName,
}: PageHeaderProps) {
  return (
    <div
      className={cn(
        'flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between',
        className
      )}
    >
      <div className={cn('min-w-0 space-y-2', contentClassName)}>
        {eyebrow ? (
          <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-primary/85">{eyebrow}</p>
        ) : null}
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">{title}</h1>
          {description ? <div className="max-w-3xl text-sm text-muted-foreground">{description}</div> : null}
        </div>
      </div>

      {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}
