import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/utils';

interface PageHeaderSkeletonProps {
  className?: string;
  withAction?: boolean;
}

interface StatsCardsSkeletonProps {
  className?: string;
  count?: number;
}

interface FilterBarSkeletonProps {
  className?: string;
  count?: number;
}

interface TabsSkeletonProps {
  className?: string;
  count?: number;
  widthClassName?: string;
}

interface SearchBarSkeletonProps {
  className?: string;
  withMeta?: boolean;
}

interface TableCardSkeletonProps {
  className?: string;
  columnCount?: number;
  rowCount?: number;
  showCardHeader?: boolean;
}

interface MapCardSkeletonProps {
  className?: string;
  heightClassName?: string;
}

interface ListCardSkeletonProps {
  className?: string;
  itemCount?: number;
}

interface SubnavRailSkeletonProps {
  className?: string;
  itemCount?: number;
  showTitle?: boolean;
}

export function PageHeaderSkeleton({ className, withAction = false }: PageHeaderSkeletonProps) {
  return (
    <div className={cn('flex flex-wrap items-start justify-between gap-3', className)}>
      <div className="space-y-2">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-4 w-80 max-w-[85vw]" />
      </div>
      {withAction ? <Skeleton className="h-9 w-36 rounded-md" /> : null}
    </div>
  );
}

export function StatsCardsSkeleton({ className, count = 4 }: StatsCardsSkeletonProps) {
  return (
    <div className={cn('grid gap-4 md:grid-cols-2 lg:grid-cols-4', className)}>
      {Array.from({ length: count }).map((_, index) => (
        <Card key={index}>
          <CardContent className="pt-6">
            <div className="space-y-3">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-9 w-16" />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

export function FilterBarSkeleton({ className, count = 2 }: FilterBarSkeletonProps) {
  return (
    <div className={cn('grid gap-3 md:grid-cols-2', className)}>
      {Array.from({ length: count }).map((_, index) => (
        <Skeleton key={index} className="h-10 w-full rounded-md" />
      ))}
    </div>
  );
}

export function TabsSkeleton({ className, count = 3, widthClassName = 'w-28' }: TabsSkeletonProps) {
  return (
    <div className={cn('flex flex-wrap gap-2 rounded-xl bg-muted/70 p-1 w-fit', className)}>
      {Array.from({ length: count }).map((_, index) => (
        <div key={index} className="flex items-center gap-2 rounded-lg px-3 py-2">
          <Skeleton className={cn('h-4', widthClassName)} />
          <Skeleton className="h-5 w-8 rounded-md" />
        </div>
      ))}
    </div>
  );
}

export function SearchBarSkeleton({ className, withMeta = false }: SearchBarSkeletonProps) {
  return (
    <div className={cn('space-y-2', className)}>
      <Skeleton className="h-10 w-full rounded-md" />
      {withMeta ? <Skeleton className="h-3 w-44 max-w-[80%]" /> : null}
    </div>
  );
}

export function TableCardSkeleton({
  className,
  columnCount = 4,
  rowCount = 8,
  showCardHeader = true,
}: TableCardSkeletonProps) {
  return (
    <Card className={className}>
      {showCardHeader ? (
        <CardHeader className="space-y-2">
          <Skeleton className="h-6 w-36" />
          <Skeleton className="h-4 w-60 max-w-[85vw]" />
        </CardHeader>
      ) : null}
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              {Array.from({ length: columnCount }).map((_, index) => (
                <TableHead key={index}>
                  <Skeleton className="h-4 w-20" />
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {Array.from({ length: rowCount }).map((_, rowIndex) => (
              <TableRow key={rowIndex}>
                {Array.from({ length: columnCount }).map((_, columnIndex) => (
                  <TableCell key={columnIndex}>
                    <Skeleton
                      className={cn(
                        'h-4',
                        columnIndex === 0 ? 'w-40' : columnIndex === columnCount - 1 ? 'w-16' : 'w-24'
                      )}
                    />
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

export function MapCardSkeleton({ className, heightClassName = 'h-[360px]' }: MapCardSkeletonProps) {
  return (
    <Card className={className}>
      <CardHeader className="space-y-2">
        <Skeleton className="h-6 w-44" />
        <Skeleton className="h-4 w-64 max-w-[85vw]" />
      </CardHeader>
      <CardContent>
        <Skeleton className={cn('w-full rounded-lg', heightClassName)} />
      </CardContent>
    </Card>
  );
}

export function ListCardSkeleton({ className, itemCount = 5 }: ListCardSkeletonProps) {
  return (
    <Card className={className}>
      <CardHeader className="space-y-2">
        <Skeleton className="h-6 w-40" />
        <Skeleton className="h-4 w-56 max-w-[85vw]" />
      </CardHeader>
      <CardContent className="space-y-3">
        {Array.from({ length: itemCount }).map((_, index) => (
          <div key={index} className="rounded-lg border p-3">
            <div className="space-y-2">
              <Skeleton className="h-4 w-56 max-w-[85vw]" />
              <Skeleton className="h-3 w-40 max-w-[75vw]" />
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

export function SubnavRailSkeleton({
  className,
  itemCount = 3,
  showTitle = true,
}: SubnavRailSkeletonProps) {
  return (
    <div className={cn('space-y-2', className)}>
      {showTitle ? <Skeleton className="ml-2 h-3 w-24" /> : null}
      <div className="space-y-1">
        {Array.from({ length: itemCount }).map((_, index) => (
          <div key={index} className="rounded-2xl border border-border/60 px-3 py-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 space-y-2">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-3 w-36 max-w-full" />
                <Skeleton className="h-3 w-28 max-w-[80%]" />
              </div>
              <Skeleton className="h-5 w-8 rounded-md" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function DashboardQueueSkeleton({ className, rowCount = 5 }: { className?: string; rowCount?: number }) {
  return <TableCardSkeleton className={className} columnCount={3} rowCount={rowCount} />;
}

export function SettingsPanelSkeleton({
  className,
  showTabs = true,
  rowCount = 5,
}: {
  className?: string;
  showTabs?: boolean;
  rowCount?: number;
}) {
  return (
    <div className={cn('space-y-4', className)}>
      {showTabs ? <TabsSkeleton count={5} widthClassName="w-24" /> : null}
      <Card className="rounded-2xl">
        <div className="border-b px-4 py-3 space-y-2">
          <Skeleton className="h-5 w-36" />
          <Skeleton className="h-4 w-72 max-w-[85vw]" />
        </div>
        <div className="divide-y">
          {Array.from({ length: rowCount }).map((_, index) => (
            <div key={index} className="flex items-start justify-between gap-4 px-4 py-3">
              <div className="space-y-2">
                <Skeleton className="h-4 w-36" />
                <Skeleton className="h-3 w-72 max-w-[70vw]" />
              </div>
              <Skeleton className="h-6 w-11 rounded-full" />
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
