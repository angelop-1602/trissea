import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

interface PassengerShellSkeletonProps {
  compactHero?: boolean;
  sections?: Array<{
    titleWidth?: string;
    bodyHeight?: string;
    rows?: number;
  }>;
}

function SkeletonRows({
  rows = 3,
  bodyHeight,
}: {
  rows?: number;
  bodyHeight?: string;
}) {
  if (bodyHeight) {
    return <Skeleton className={cn(bodyHeight, 'rounded-[1.6rem]')} />;
  }

  return (
    <div className="divide-y divide-border/50 overflow-hidden rounded-[1.6rem] border border-border/50 bg-background/55">
      {Array.from({ length: rows }).map((_, index) => (
        <div key={index} className="space-y-2 px-4 py-4">
          <Skeleton className="h-3 w-16 rounded-full" />
          <Skeleton className={cn('h-4 rounded-full', index % 2 === 0 ? 'w-10/12' : 'w-8/12')} />
          <Skeleton className="h-3 w-5/12 rounded-full" />
        </div>
      ))}
    </div>
  );
}

export function PassengerShellSkeleton({
  compactHero = false,
  sections = [
    { titleWidth: 'w-24', rows: 2 },
    { titleWidth: 'w-20', rows: 3 },
  ],
}: PassengerShellSkeletonProps) {
  return (
    <div className="space-y-6">
      <section className="space-y-4 rounded-[2rem] border border-primary/15 bg-primary/6 px-4 py-5">
        <div className="space-y-2">
          <Skeleton className="h-3 w-20 rounded-full" />
          <Skeleton className={compactHero ? 'h-7 w-1/2 rounded-full' : 'h-7 w-2/3 rounded-full'} />
          <Skeleton className="h-4 w-4/5 rounded-full" />
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-11 flex-1 rounded-full" />
          <Skeleton className="h-11 flex-1 rounded-full" />
        </div>
      </section>

      {sections.map((section, index) => (
        <section key={`${section.titleWidth ?? 'title'}-${section.bodyHeight ?? 'body'}-${index}`} className="space-y-3">
          <div className="space-y-2 px-1">
            <Skeleton className={cn('h-3 rounded-full', section.titleWidth ?? 'w-24')} />
            <Skeleton className="h-4 w-40 rounded-full" />
          </div>
          <SkeletonRows rows={section.rows} bodyHeight={section.bodyHeight} />
        </section>
      ))}
    </div>
  );
}
