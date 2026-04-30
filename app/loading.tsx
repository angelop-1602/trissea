import { PageLoadingState } from '@/components/page-state';
import { BRAND_NAME } from '@/lib/brand';

export default function RootLoading() {
  return <PageLoadingState label={`Loading ${BRAND_NAME}...`} className="min-h-screen" />;
}
