import { PassengerAppShell } from '@/components/passenger/passenger-app-shell';
import { PassengerShellSkeleton } from '@/components/passenger/passenger-shell-skeleton';

export default function PassengerLoading() {
  return (
    <PassengerAppShell
      title="Passenger"
      subtitle="Preparing the latest view."
      topContext="Passenger"
      headerVariant="compact"
      headerSurface="minimal"
    >
      <PassengerShellSkeleton />
    </PassengerAppShell>
  );
}
