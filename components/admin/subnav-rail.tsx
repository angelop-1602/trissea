'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export interface AdminSubnavItem {
  key: string;
  label: string;
  description: string;
  active: boolean;
  badge?: ReactNode;
  href?: string;
  onClick?: () => void;
}

function AdminSubnavItemContent({ item }: { item: AdminSubnavItem }) {
  return (
    <>
      <div className="min-w-0 space-y-1">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">{item.label}</span>
          {item.badge != null ? (
            <span
              className={cn(
                'rounded-md px-1.5 py-0.5 text-[11px] font-semibold tabular-nums',
                item.active ? 'bg-primary/15 text-primary' : 'bg-muted text-muted-foreground'
              )}
            >
              {item.badge}
            </span>
          ) : null}
        </div>
        <p className="text-xs leading-5 text-muted-foreground">{item.description}</p>
      </div>
    </>
  );
}

function getItemClassName(active: boolean) {
  return cn(
    'flex w-full items-start justify-between gap-3 rounded-2xl border px-3 py-3 text-left transition-colors duration-200',
    active
      ? 'border-primary/20 bg-primary/10 text-foreground'
      : 'border-transparent bg-transparent text-muted-foreground hover:border-border/80 hover:bg-muted/60 hover:text-foreground'
  );
}

export function AdminSubnavRail({
  title,
  items,
  className,
}: {
  title?: string;
  items: AdminSubnavItem[];
  className?: string;
}) {
  return (
    <div className={cn('space-y-2', className)}>
      {title ? (
        <p className="px-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          {title}
        </p>
      ) : null}

      <div className="space-y-1">
        {items.map((item) =>
          item.href ? (
            <Link key={item.key} href={item.href} className={getItemClassName(item.active)}>
              <AdminSubnavItemContent item={item} />
            </Link>
          ) : (
            <button
              key={item.key}
              type="button"
              onClick={item.onClick}
              className={getItemClassName(item.active)}
            >
              <AdminSubnavItemContent item={item} />
            </button>
          )
        )}
      </div>
    </div>
  );
}
