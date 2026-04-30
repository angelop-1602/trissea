import * as React from 'react';
import { cn } from '@/lib/utils';

export const ACTIVE_BOOKING_SHEET_COLLAPSED_HEIGHT =
  'min(calc(100dvh - 0.75rem), calc(15.75rem + 6.85rem + env(safe-area-inset-bottom)))';
export const ACTIVE_BOOKING_SHEET_EXPANDED_MAX_HEIGHT = 'min(82dvh, 46rem)';
export const ACTIVE_BOOKING_SHEET_FOOTER_PADDING = 'calc(6.85rem + env(safe-area-inset-bottom))';

export function ActiveBookingSheetShell({
  ariaLabel,
  height,
  maxHeight,
  children,
}: {
  ariaLabel: string;
  height?: string;
  maxHeight?: string;
  children: React.ReactNode;
}) {
  return (
    <section
      aria-label={ariaLabel}
      className="pointer-events-auto mx-auto flex w-full flex-col overflow-hidden rounded-t-[2rem] border border-b-0 border-border/60 bg-background/92 shadow-[0_-30px_70px_-35px_rgba(0,0,0,0.72)] backdrop-blur-2xl transition-[height] duration-300 ease-out"
      style={{ height, maxHeight }}
    >
      {children}
    </section>
  );
}

export function ActiveBookingSheetHandle({
  expanded,
  onClick,
  expandedLabel,
  collapsedLabel,
}: {
  expanded?: boolean;
  onClick?: () => void;
  expandedLabel?: string;
  collapsedLabel?: string;
}) {
  const handle = <div className="mx-auto h-1.5 w-12 rounded-full bg-border/70" aria-hidden />;

  if (!onClick) {
    return <div className="flex items-center justify-center px-4 pt-3 pb-1 text-muted-foreground">{handle}</div>;
  }

  return (
    <div className="px-4 pt-3">
      <button
        type="button"
        className="flex w-full items-center justify-center py-1 text-muted-foreground"
        onClick={onClick}
        aria-expanded={expanded}
        aria-label={expanded ? expandedLabel : collapsedLabel}
      >
        {handle}
      </button>
    </div>
  );
}

export function ActiveBookingSheetLayout({
  active,
  children,
}: {
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className={active ? 'flex max-h-full min-h-0 flex-col' : 'flex h-full min-h-0 flex-1 flex-col'}>
      {children}
    </div>
  );
}

export function ActiveBookingSheetBody({
  active,
  children,
  className,
}: {
  active: boolean;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        active
          ? 'min-h-0 overflow-y-auto overscroll-contain px-4 pb-4'
          : 'min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-4',
        className
      )}
    >
      {children}
    </div>
  );
}

export function ActiveBookingSheetFooter({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="shrink-0 border-t border-border/55 bg-background/94 px-4 pt-3 backdrop-blur-xl"
      style={{ paddingBottom: ACTIVE_BOOKING_SHEET_FOOTER_PADDING }}
    >
      {children}
    </div>
  );
}

export function ActiveBookingHero({
  eyebrow,
  title,
  subtitle,
  trailing,
}: {
  eyebrow: string;
  title: string;
  subtitle: string;
  trailing?: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="space-y-2">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">{eyebrow}</p>
        <div className="space-y-1">
          <h2 className="text-xl font-semibold tracking-tight">{title}</h2>
          <p className="text-sm text-muted-foreground">{subtitle}</p>
        </div>
      </div>
      {trailing ? <div className="shrink-0">{trailing}</div> : null}
    </div>
  );
}

export function ActiveBookingPersonCard({
  label,
  name,
  initials,
  description,
  trailing,
}: {
  label: string;
  name: string;
  initials: string;
  description: string;
  trailing?: React.ReactNode;
}) {
  return (
    <div className="rounded-[1.35rem] border border-border/50 bg-background/72 px-4 py-3">
      <div className="flex items-center gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary/12 text-sm font-semibold text-primary">
          {initials}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">{label}</p>
          <p className="truncate text-sm font-semibold text-foreground">{name}</p>
          <p className="text-xs text-muted-foreground">{description}</p>
        </div>
        {trailing ? <div className="shrink-0">{trailing}</div> : null}
      </div>
    </div>
  );
}

export function ActiveBookingCompactPersonRow({
  label,
  name,
  initials,
  trailing,
}: {
  label: string;
  name: string;
  initials: string;
  trailing?: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-3 border-b border-border/45 py-2.5">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/12 text-sm font-semibold text-primary">
        {initials}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-foreground">{name}</p>
        <p className="text-xs text-muted-foreground">{label}</p>
      </div>
      {trailing ? <div className="shrink-0">{trailing}</div> : null}
    </div>
  );
}

export function ActiveBookingCompactLocationRow({
  icon,
  toneClassName,
  label,
  value,
  trailing,
  withBorder = true,
}: {
  icon: React.ReactNode;
  toneClassName: string;
  label: string;
  value: string;
  trailing?: React.ReactNode;
  withBorder?: boolean;
}) {
  return (
    <div className={cn('flex items-center gap-3 py-2.5', withBorder ? 'border-b border-border/45' : '')}>
      <div className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl', toneClassName)}>
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium leading-snug text-foreground">{value}</p>
        <p className="mt-1 text-xs text-muted-foreground">{label}</p>
      </div>
      {trailing ? <div className="shrink-0">{trailing}</div> : null}
    </div>
  );
}

export function ActiveBookingRouteSummary({
  icon,
  toneClassName,
  pickup,
  dropoff,
  via,
}: {
  icon: React.ReactNode;
  toneClassName: string;
  pickup: string;
  dropoff: string;
  via?: string | null;
}) {
  return (
    <div className="flex items-start gap-3">
      <div className={cn('mt-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl', toneClassName)}>
        {icon}
      </div>
      <div className="min-w-0 flex-1 space-y-1">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Route</p>
        <p className="text-sm font-medium">{pickup}</p>
        <p className="text-xs text-muted-foreground">to {dropoff}</p>
        {via ? <p className="text-xs text-muted-foreground">via {via}</p> : null}
      </div>
    </div>
  );
}
