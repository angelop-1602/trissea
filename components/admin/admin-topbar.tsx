'use client';

import { PanelLeft, PanelLeftClose } from 'lucide-react';
import { ReturnNavigation } from '@/components/return-navigation';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface AdminTopbarProps {
  activeLabel: string;
  areaLabel: string;
  scopeLabel: string;
  collapsed: boolean;
  onToggleCollapsed: () => void;
  returnHref: string;
}

export function AdminTopbar({
  activeLabel,
  areaLabel,
  scopeLabel,
  collapsed,
  onToggleCollapsed,
  returnHref,
}: AdminTopbarProps) {
  return (
    <div className="border-b border-border/60 bg-[linear-gradient(180deg,color-mix(in_oklab,var(--background),white_2%)_0%,color-mix(in_oklab,var(--background),transparent_0%)_100%)] backdrop-blur-xl">
      <div className="flex h-18 items-center justify-between gap-4 px-6">
        <div className="flex min-w-0 items-center gap-3">
          <ReturnNavigation
            fallbackHref={returnHref}
            className="shrink-0 rounded-xl border border-border/50 bg-card/70 text-foreground hover:bg-accent/70"
          />

          <Button
            variant="ghost"
            size="icon"
            className="shrink-0 rounded-xl border border-border/50 bg-card/70 text-foreground hover:bg-accent/70"
            onClick={onToggleCollapsed}
          >
            {collapsed ? <PanelLeft className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
          </Button>

          <div className="min-w-0 space-y-1">
            <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
              {areaLabel}
            </p>
            <h1 className="truncate text-lg font-semibold tracking-tight text-foreground">{activeLabel}</h1>
          </div>
        </div>

        <div className="hidden items-center gap-2 md:flex">
          <div
            className={cn(
              'rounded-full border px-3 py-1.5 text-xs font-medium',
              'border-primary/18 bg-primary/10 text-foreground shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]'
            )}
          >
            {scopeLabel}
          </div>
        </div>
      </div>
    </div>
  );
}
