import { PageLoadingState } from '@/components/page-state';

export default function DriverLoading() {
  return (
    <PageLoadingState
      label="Loading driver dashboard..."
      className="theme-driver min-h-screen bg-background text-foreground"
    />
  );
}
