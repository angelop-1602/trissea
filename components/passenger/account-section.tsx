import * as React from 'react';
import { ChevronRight } from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';

export function AccountSection({
  title,
  description,
  children,
  className,
}: {
  title?: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cn('space-y-3', className)}>
      {title ? (
        <div className="space-y-1 px-1">
          <h2 className="text-sm font-semibold tracking-tight text-foreground">{title}</h2>
          {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
        </div>
      ) : null}
      <div className="overflow-hidden rounded-[1.9rem] border border-border/60 bg-background/58">
        {children}
      </div>
    </section>
  );
}

export function AccountRow({
  label,
  description,
  leading,
  trailing,
  href,
  onClick,
  className,
}: {
  label: string;
  description?: string;
  leading?: React.ReactNode;
  trailing?: React.ReactNode;
  href?: string;
  onClick?: () => void;
  className?: string;
}) {
  const content = (
    <div
      className={cn(
        'flex w-full items-center gap-3 px-4 py-4 text-left transition hover:bg-muted/12',
        className
      )}
    >
      {leading ? <div className="shrink-0">{leading}</div> : null}
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">{label}</p>
        {description ? <p className="text-xs text-muted-foreground">{description}</p> : null}
      </div>
      {trailing ?? <ChevronRight className="h-4 w-4 text-muted-foreground" />}
    </div>
  );

  if (href) {
    return <Link href={href}>{content}</Link>;
  }

  if (onClick) {
    return (
      <button type="button" onClick={onClick} className="w-full">
        {content}
      </button>
    );
  }

  return content;
}

export function AccountValueRow({
  label,
  value,
  className,
}: {
  label: string;
  value: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('px-4 py-4', className)}>
      <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">{label}</p>
      <div className="mt-1 text-sm">{value}</div>
    </div>
  );
}
