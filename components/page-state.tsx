import { AlertCircle } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

type PageLoadingTone = 'passenger' | 'driver';

const loadingToneClasses: Record<PageLoadingTone, string> = {
  passenger: 'theme-passenger',
  driver: 'theme-driver',
};

interface PageLoadingStateProps {
  label?: string;
  tone?: PageLoadingTone;
  className?: string;
}

interface InlineErrorStateProps {
  message: string;
  onRetry?: () => void;
  retryLabel?: string;
  className?: string;
}

export function PageLoadingState({
  label = 'Loading content',
  tone,
  className,
}: PageLoadingStateProps) {
  return (
    <div
      className={cn(
        'px-4 py-5',
        tone ? [loadingToneClasses[tone], 'min-h-screen bg-background text-foreground'] : null,
        className
      )}
      aria-label={label}
      aria-busy="true"
    >
      <span className="sr-only">{label}</span>
      <div className="mx-auto w-full max-w-3xl space-y-5">
        <section className="space-y-3 rounded-[2rem] border border-primary/15 bg-primary/[0.06] px-4 py-5">
          <Skeleton className="h-3 w-20 rounded-full" />
          <Skeleton className="h-7 w-40 rounded-full" />
          <Skeleton className="h-4 w-4/5 rounded-full" />
          <div className="flex gap-2 pt-1">
            <Skeleton className="h-11 flex-1 rounded-full" />
            <Skeleton className="h-11 flex-1 rounded-full" />
          </div>
        </section>

        <div className="space-y-3">
          <div className="space-y-2 px-1">
            <Skeleton className="h-3 w-24 rounded-full" />
            <Skeleton className="h-4 w-44 rounded-full" />
          </div>
          <div className="divide-y divide-border/50 overflow-hidden rounded-[1.75rem] border border-border/60 bg-background/55">
            {Array.from({ length: 3 }).map((_, index) => (
              <div key={index} className="space-y-2 px-4 py-4">
                <Skeleton className="h-3 w-16 rounded-full" />
                <Skeleton className="h-4 rounded-full" />
                <Skeleton className="h-3 w-2/5 rounded-full" />
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-3">
          <div className="space-y-2 px-1">
            <Skeleton className="h-3 w-20 rounded-full" />
            <Skeleton className="h-4 w-36 rounded-full" />
          </div>
          <div className="space-y-3 rounded-[1.75rem] border border-border/60 bg-background/55 p-4">
            <Skeleton className="h-11 w-full rounded-[1.2rem]" />
            <Skeleton className="h-11 w-full rounded-[1.2rem]" />
            <div className="grid grid-cols-2 gap-3">
              <Skeleton className="h-24 rounded-[1.35rem]" />
              <Skeleton className="h-24 rounded-[1.35rem]" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function InlineErrorState({
  message,
  onRetry,
  retryLabel = 'Try again',
  className,
}: InlineErrorStateProps) {
  return (
    <Alert variant="destructive" className={cn('border-destructive/30', className)}>
      <AlertCircle className="h-4 w-4" />
      <AlertTitle>Something went wrong</AlertTitle>
      <AlertDescription className="mt-1 flex flex-wrap items-center gap-3">
        <span>{message}</span>
        {onRetry ? (
          <Button variant="outline" size="sm" onClick={onRetry}>
            {retryLabel}
          </Button>
        ) : null}
      </AlertDescription>
    </Alert>
  );
}
