'use client';

import { DriverAppShell } from '@/components/driver/driver-app-shell';
import { InlineErrorState, PageLoadingState } from '@/components/page-state';
import {
  AccountSection,
  AccountValueRow,
} from '@/components/passenger/account-section';
import { useDriverAccountData } from '@/hooks/use-driver-account-data';
import { formatDriverAccountDate } from '@/lib/driver-account-presenters';

export default function DriverVehicleInfoPage() {
  const { data, loading, error, reload } = useDriverAccountData();

  if (loading) {
    return (
      <PageLoadingState
        label="Loading vehicle information..."
        className="theme-driver min-h-screen bg-background text-foreground"
      />
    );
  }

  return (
    <DriverAppShell
      title="Vehicle Info"
      subtitle="Vehicle and compliance records on file for your driver account."
      backHref="/driver/account"
      topContext="Account"
      headerVariant="compact"
      headerSurface="minimal"
    >
      {error ? <InlineErrorState message={error} onRetry={() => void reload()} /> : null}

      {data ? (
        <>
          <AccountSection
            title="Vehicle record"
            description="These are the current vehicle details saved during onboarding or admin review."
          >
            <AccountValueRow
              label="Vehicle type"
              value={data.profile.vehicleType ?? 'Not provided'}
            />
            <div className="border-t border-border/60">
              <AccountValueRow
                label="Vehicle model"
                value={data.profile.vehicleModel ?? 'Not provided'}
              />
            </div>
            <div className="border-t border-border/60">
              <AccountValueRow
                label="Vehicle color"
                value={data.profile.vehicleColor ?? 'Not provided'}
              />
            </div>
            <div className="border-t border-border/60">
              <AccountValueRow
                label="Plate number"
                value={data.profile.plateNumber ?? 'Not provided'}
              />
            </div>
          </AccountSection>

          <AccountSection
            title="License and compliance"
            description="These fields affect driver verification and remain read-only in the current driver account area."
          >
            <AccountValueRow
              label="License number"
              value={data.profile.licenseNumber ?? 'Not provided'}
            />
            <div className="border-t border-border/60">
              <AccountValueRow
                label="License expiry"
                value={formatDriverAccountDate(data.profile.licenseExpiry)}
              />
            </div>
            <div className="border-t border-border/60">
              <AccountValueRow
                label="Self-service boundary"
                value="Vehicle and license records are read-only here. Ask your tenant administrator to review and update these details if they change."
              />
            </div>
          </AccountSection>
        </>
      ) : null}
    </DriverAppShell>
  );
}
