'use client';

import type { ReactNode } from 'react';
import { ReturnNavigation } from '@/components/return-navigation';
import { cn } from '@/lib/utils';

interface MobileUserTopbarProps {
  title?: string;
  subtitle?: string;
  backHref?: string;
  topContext?: string;
  compact?: boolean;
  surface?: 'panel' | 'minimal';
  contextIcon?: ReactNode;
  trailing?: ReactNode;
}

export function MobileUserTopbar({
  backHref,
  topContext,
  compact = false,
  surface = 'panel',
  contextIcon,
  trailing,
}: MobileUserTopbarProps) {
  const isMinimal = surface === 'minimal';

  return (
    <header className="sticky top-0 z-40">
      <div
        className="px-4 pb-2"
        style={{ paddingTop: 'max(env(safe-area-inset-top), 1rem)' }}
      >
        <div className="mx-auto w-full max-w-screen-sm">
          <div
            className={cn(
              'transition-all',
              isMinimal
                ? 'rounded-[1.5rem] bg-transparent px-0 py-0.5'
                : 'rounded-[1.9rem] border border-border/60 bg-background/72 px-3.5 py-3 shadow-[0_18px_45px_-30px_rgba(0,0,0,0.6)] backdrop-blur-2xl supports-[backdrop-filter]:bg-background/66'
            )}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className={cn('mb-1.5 flex items-center gap-2', compact ? 'mb-1' : 'mb-1.5')}>
                  {backHref ? (
                    <ReturnNavigation
                      fallbackHref={backHref}
                      className={cn(
                        'h-9 w-9 rounded-full border border-border/65 text-foreground',
                        isMinimal
                          ? 'bg-background/76 backdrop-blur-xl'
                          : 'bg-background/62'
                      )}
                    />
                  ) : null}

                  {topContext ? (
                    <div
                      className={cn(
                        'inline-flex items-center gap-1.5 rounded-full border border-primary/20 text-primary',
                        isMinimal
                          ? 'bg-background/76 px-2.5 py-1 backdrop-blur-xl'
                          : 'bg-primary/10 px-2.5 py-1',
                        compact ? 'text-[9px]' : 'text-[10px]',
                        'font-semibold uppercase tracking-[0.22em]'
                      )}
                    >
                      {contextIcon ? <span className="flex h-3.5 w-3.5 items-center justify-center">{contextIcon}</span> : null}
                      <span>{topContext}</span>
                    </div>
                  ) : null}
                </div>


              </div>

              {trailing ? <div className="shrink-0">{trailing}</div> : null}
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
