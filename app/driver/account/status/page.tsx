'use client';

import { DriverAppShell } from '@/components/driver/driver-app-shell';
import { InlineErrorState, PageLoadingState } from '@/components/page-state';
import {
  AccountSection,
  AccountValueRow,
} from '@/components/passenger/account-section';
import { useDriverAccountData } from '@/hooks/use-driver-account-data';
import {
  formatDriverAccountDateTime,
  formatDriverAccountLabel,
  getDriverAccessBadgeClassName,
  getDriverAccessLabel,
  getDriverDocumentStatusBadgeClassName,
  getDriverOperationalBadgeClassName,
  getDriverOperationalStateLabel,
} from '@/lib/driver-account-presenters';
import { cn } from '@/lib/utils';

function StatusPill({
  label,
  className,
}: {
  label: string;
  className: string;
}) {
  return (
    <span
      className={cn(
        'inline-flex rounded-full border px-3 py-1 text-xs font-medium',
        className,
      )}
    >
      {label}
    </span>
  );
}

export default function DriverAccountStatusPage() {
  const { data, loading, error, reload } = useDriverAccountData();

  if (loading) {
    return (
      <PageLoadingState
        label="Loading driver account status..."
        className="theme-driver min-h-screen bg-background text-foreground"
      />
    );
  }

  return (
    <DriverAppShell
      title="Account Status"
      subtitle="Verification, restriction, and document review status tied to your driver account."
      backHref="/driver/account"
      topContext="Account"
      headerVariant="compact"
      headerSurface="minimal"
    >
      {error ? <InlineErrorState message={error} onRetry={() => void reload()} /> : null}

      {data ? (
        <>
          <AccountSection
            title="Current access"
            description="These are the live account states that control driver access today."
          >
            <div className="flex flex-wrap gap-2 px-4 py-4">
              <StatusPill
                label={getDriverAccessLabel(data.accessState)}
                className={getDriverAccessBadgeClassName(data.accessState)}
              />
              <StatusPill
                label={getDriverOperationalStateLabel(data.profile.operationalState)}
                className={getDriverOperationalBadgeClassName(
                  data.profile.operationalState,
                )}
              />
              <StatusPill
                label={formatDriverAccountLabel(data.profile.verificationStatus)}
                className={getDriverAccessBadgeClassName(
                  data.profile.verificationStatus === 'verified'
                    ? 'active'
                    : 'pending',
                )}
              />
            </div>
            <div className="border-t border-border/60">
              <AccountValueRow
                label="Verification approved"
                value={formatDriverAccountDateTime(
                  data.profile.verificationApprovedAt,
                  'No approval timestamp recorded yet',
                )}
              />
            </div>
            <div className="border-t border-border/60">
              <AccountValueRow
                label="Last review"
                value={formatDriverAccountDateTime(
                  data.profile.lastVerificationReviewAt,
                  'No verification review recorded yet',
                )}
              />
            </div>
            <div className="border-t border-border/60">
              <AccountValueRow
                label="Restriction state"
                value={formatDriverAccountLabel(data.profile.restrictionStatus)}
              />
            </div>
            {data.user.driverRestrictionReason ? (
              <div className="border-t border-border/60">
                <AccountValueRow
                  label="Restriction reason"
                  value={data.user.driverRestrictionReason}
                />
              </div>
            ) : null}
          </AccountSection>

          <AccountSection
            title="Document summary"
            description="Only real onboarding records already stored on your driver profile appear here."
          >
            <AccountValueRow
              label="Submitted"
              value={`${data.documentSummary.submitted} pending review`}
            />
            <div className="border-t border-border/60">
              <AccountValueRow
                label="Approved"
                value={`${data.documentSummary.approved} approved records`}
              />
            </div>
            <div className="border-t border-border/60">
              <AccountValueRow
                label="Rejected"
                value={`${data.documentSummary.rejected} rejected records`}
              />
            </div>
            <div className="border-t border-border/60">
              <AccountValueRow
                label="Driver app boundary"
                value="Document upload and resubmission are not available from the driver app yet."
              />
            </div>
          </AccountSection>

          <AccountSection
            title="On-file documents"
            description="Status shown below is informational only in this phase."
          >
            {data.documents.length === 0 ? (
              <AccountValueRow
                label="Documents"
                value="No submitted driver documents or metadata are on file yet."
              />
            ) : (
              data.documents.map((document, index) => (
                <div
                  key={document.id}
                  className={index > 0 ? 'border-t border-border/60 px-4 py-4' : 'px-4 py-4'}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1">
                      <p className="text-sm font-medium">
                        {formatDriverAccountLabel(document.documentType)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Submitted {formatDriverAccountDateTime(document.submittedAt)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {document.remarks ??
                          'No additional review notes are available for this record.'}
                      </p>
                    </div>
                    <StatusPill
                      label={formatDriverAccountLabel(document.reviewStatus)}
                      className={getDriverDocumentStatusBadgeClassName(
                        document.reviewStatus,
                      )}
                    />
                  </div>
                </div>
              ))
            )}
          </AccountSection>

          {data.latestVerificationReview ? (
            <AccountSection
              title="Latest verification review"
              description="This is the newest recorded driver verification review on file."
            >
              <AccountValueRow
                label="Decision"
                value={formatDriverAccountLabel(
                  data.latestVerificationReview.decision,
                )}
              />
              <div className="border-t border-border/60">
                <AccountValueRow
                  label="Reviewed on"
                  value={formatDriverAccountDateTime(
                    data.latestVerificationReview.createdAt,
                  )}
                />
              </div>
              <div className="border-t border-border/60">
                <AccountValueRow
                  label="Reviewed by"
                  value={
                    data.latestVerificationReview.reviewedBy?.name ??
                    'Reviewer not recorded'
                  }
                />
              </div>
              <div className="border-t border-border/60">
                <AccountValueRow
                  label="Remarks"
                  value={
                    data.latestVerificationReview.remarks ??
                    'No verification remarks were recorded.'
                  }
                />
              </div>
            </AccountSection>
          ) : null}

          {data.latestRestrictionLog ? (
            <AccountSection
              title="Latest restriction log"
              description="Shown only when a real restriction or reinstatement record exists."
            >
              <AccountValueRow
                label="Action"
                value={formatDriverAccountLabel(data.latestRestrictionLog.action)}
              />
              <div className="border-t border-border/60">
                <AccountValueRow
                  label="Recorded on"
                  value={formatDriverAccountDateTime(
                    data.latestRestrictionLog.createdAt,
                  )}
                />
              </div>
              <div className="border-t border-border/60">
                <AccountValueRow
                  label="Recorded by"
                  value={
                    data.latestRestrictionLog.actedBy?.name ??
                    'Actor not recorded'
                  }
                />
              </div>
              <div className="border-t border-border/60">
                <AccountValueRow
                  label="Reason"
                  value={
                    data.latestRestrictionLog.reason ??
                    'No restriction reason was recorded.'
                  }
                />
              </div>
            </AccountSection>
          ) : null}
        </>
      ) : null}
    </DriverAppShell>
  );
}
