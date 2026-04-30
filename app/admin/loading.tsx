import { PageHeaderSkeleton, StatsCardsSkeleton, SubnavRailSkeleton, TableCardSkeleton } from '@/components/dashboard/loading-skeletons';

export default function AdminLoading() {
  return (
    <div className="space-y-6 p-6">
      <PageHeaderSkeleton withAction />
      <StatsCardsSkeleton count={4} />
      <div className="grid gap-6 lg:grid-cols-[240px_minmax(0,1fr)]">
        <SubnavRailSkeleton itemCount={3} />
        <TableCardSkeleton columnCount={4} />
      </div>
    </div>
  );
}
