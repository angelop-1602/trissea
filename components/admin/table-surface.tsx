import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface TableSurfaceProps {
  title?: string;
  description?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
}

export function TableSurface({
  title,
  description,
  actions,
  children,
  className,
  bodyClassName,
}: TableSurfaceProps) {
  return (
    <section
      className={cn(
        'overflow-hidden rounded-[1.6rem] border border-border/70 bg-card/86 shadow-[0_18px_50px_-34px_rgba(0,0,0,0.32)] backdrop-blur-sm',
        className
      )}
    >
      {title || description || actions ? (
        <div className="flex flex-col gap-3 border-b border-border/60 px-5 py-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-1">
            {title ? <h2 className="text-base font-semibold text-foreground">{title}</h2> : null}
            {description ? <div className="text-sm text-muted-foreground">{description}</div> : null}
          </div>
          {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
        </div>
      ) : null}
      <div className={cn('px-5 py-4', bodyClassName)}>{children}</div>
    </section>
  );
}
