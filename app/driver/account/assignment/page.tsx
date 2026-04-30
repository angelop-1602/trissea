'use client';

import Link from 'next/link';
import { DriverAppShell } from '@/components/driver/driver-app-shell';
import { InlineErrorState, PageLoadingState } from '@/components/page-state';
import {
  AccountSection,
  AccountValueRow,
} from '@/components/passenger/account-section';
import { Button } from '@/components/ui/button';
import { useDriverAccountData } from '@/hooks/use-driver-account-data';
import {
  formatDriverAccountDateTime,
  getDriverOperationalStateLabel,
  getDriverVisibilityScopeLabel,
} from '@/lib/driver-account-presenters';

export default function DriverAssignmentInfoPage() {
  const { data, loading, error, reload } = useDriverAccountData();

  if (loading) {
    return (
      <PageLoadingState
        label="Loading TODA and assignment information..."
        className="theme-driver min-h-screen bg-background text-foreground"
      />
    );
  }

  return (
    <DriverAppShell
      title="TODA / Assignment Info"
      subtitle="Assigned terminal context, duty visibility, and dispatch-related records on file."
      backHref="/driver/account"
      topContext="Account"
      headerVariant="compact"
      headerSurface="minimal"
    >
      {error ? <InlineErrorState message={error} onRetry={() => void reload()} /> : null}

      {data ? (
        <>
          <AccountSection
            title="Assigned TODA / terminal"
            description="Assignment and dispatch scope are operational records, so they stay read-only here."
          >
            <AccountValueRow
              label="Assigned TODA"
              value={data.profile.toda?.name ?? 'No TODA / terminal assigned'}
            />
            <div className="border-t border-border/60">
              <AccountValueRow
                label="Location"
                value={data.profile.toda?.location ?? 'No terminal location on file'}
              />
            </div>
            <div className="border-t border-border/60">
              <AccountValueRow
                label="Membership ID"
                value={data.profile.todaMembershipId ?? 'Not provided'}
              />
            </div>
            <div className="border-t border-border/60">
              <AccountValueRow
                label="Terminal board scope"
                value={getDriverVisibilityScopeLabel(data.profile.visibilityScope)}
              />
            </div>
            <div className="border-t border-border/60">
              <AccountValueRow
                label="Queue snapshot"
                value={
                  data.profile.toda
                    ? `${data.profile.toda.currentQueued} of ${data.profile.toda.capacity} queue slots in use`
                    : 'Queue snapshot is unavailable without an assigned terminal.'
                }
              />
            </div>
          </AccountSection>

          <AccountSection
            title="Live duty context"
            description="These values reflect your current operational state and presence heartbeat."
          >
            <AccountValueRow
              label="Duty state"
              value={data.presence.isOnline ? 'On duty' : 'Off duty'}
            />
            <div className="border-t border-border/60">
              <AccountValueRow
                label="Operational state"
                value={getDriverOperationalStateLabel(data.profile.operationalState)}
              />
            </div>
            <div className="border-t border-border/60">
              <AccountValueRow
                label="Online since"
                value={formatDriverAccountDateTime(
                  data.presence.onlineSinceAt,
                  'Not currently on duty',
                )}
              />
            </div>
            <div className="border-t border-border/60">
              <AccountValueRow
                label="Last heartbeat"
                value={formatDriverAccountDateTime(
                  data.presence.lastHeartbeatAt,
                  'No presence heartbeat recorded',
                )}
              />
            </div>
            <div className="border-t border-border/60 px-4 py-4">
              <Button asChild variant="outline" className="h-11 w-full rounded-full">
                <Link href="/driver/toda">Open TODA Board</Link>
              </Button>
            </div>
          </AccountSection>

          <AccountSection
            title="Update boundary"
            description="This phase shows assignment details honestly without adding unsupported editing flows."
          >
            <AccountValueRow
              label="Read-only"
              value="TODA assignment, membership linkage, and terminal visibility are admin-controlled in the current driver app."
            />
          </AccountSection>
        </>
      ) : null}
    </DriverAppShell>
  );
}
