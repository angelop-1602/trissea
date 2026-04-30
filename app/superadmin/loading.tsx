import { PageHeaderSkeleton, StatsCardsSkeleton, TableCardSkeleton } from '@/components/dashboard/loading-skeletons';

export default function SuperadminLoading() {
  return (
    <div className="space-y-6 p-6">
      <PageHeaderSkeleton />
      <StatsCardsSkeleton count={4} />
      <TableCardSkeleton columnCount={4} />
    </div>
  );
}
