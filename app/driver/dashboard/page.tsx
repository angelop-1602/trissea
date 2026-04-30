'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import {
  ArrowRight,
  CheckCircle2,
  ListOrdered,
  MapPin,
  Power,
  Route,
  Wallet,
} from 'lucide-react';
import { RideFeedbackModal } from '@/components/ride/ride-feedback-modal';
import { useStore } from '@/lib/store-context';
import { DriverAppShell } from '@/components/driver/driver-app-shell';
import { InlineErrorState, PageLoadingState } from '@/components/page-state';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/status-badge';
import {
  getDriverSummaryData,
  type DriverSummaryData,
} from '@/lib/dashboard/client';
import { useDriverDutyIntent } from '@/hooks/use-driver-duty-intent';
import { submitRideFeedback } from '@/lib/booking/client';
import {
  clearRideFeedbackPrompt,
  readRideFeedbackPrompt,
  type RideFeedbackPrompt,
} from '@/lib/ride-feedback-prompt';
import { cn } from '@/lib/utils';

function formatCurrency(value: number) {
  return new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: 'PHP',
    maximumFractionDigits: 0,
  }).format(value);
}

function formatHeartbeatTime(value: string | Date | null) {
  if (!value) return 'No recent duty heartbeat yet';

  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return 'No recent duty heartbeat yet';

  return `Last synced ${new Intl.DateTimeFormat('en-PH', {
    hour: 'numeric',
    minute: '2-digit',
  }).format(date)}`;
}

function getHomeStateContent(input: {
  isDutyOn: boolean;
  hasActiveRide: boolean;
  assignedCount: number;
  terminalName: string | null;
}) {
  if (input.hasActiveRide) {
    return {
      eyebrow: 'Driver state',
      title: 'Current trip needs your attention',
      copy:
        'Resume the assigned trip, keep your route updates moving, and stay ready for the next required trip action.',
    };
  }

  if (input.isDutyOn) {
    return {
      eyebrow: 'Driver state',
      title: 'On duty and ready for dispatch',
      copy:
        input.assignedCount > 0
          ? `${input.assignedCount} assigned ride${input.assignedCount === 1 ? '' : 's'} need attention right now.`
          : input.terminalName
            ? `You are visible for dispatch from ${input.terminalName}. New matched rides will appear in Assigned.`
            : 'You are visible for dispatch. New matched rides will appear in Assigned as terminal dispatch routes work to you.',
    };
  }

  return {
    eyebrow: 'Driver state',
    title: 'Currently off duty',
    copy: input.terminalName
      ? `Go on duty when you are ready to receive matched rides from ${input.terminalName}.`
      : 'Go on duty when you are ready to receive matched rides from terminal dispatch.',
  };
}

function formatRideSubtitle(status: string) {
  switch (status) {
    case 'matched':
      return 'A ride has been matched to your account. Open Active to start heading to pickup.';
    case 'en_route':
      return 'You are already on the way to pickup. Continue the live trip flow from Active.';
    case 'arrived':
      return 'You have reached pickup. Start the trip once the passenger boards.';
    case 'in_trip':
      return 'The passenger is on board and the trip is in progress.';
    default:
      return 'Your current ride details are ready in Active.';
  }
}

function OperationalRow({
  label,
  value,
  detail,
  icon,
  accent,
}: {
  label: string;
  value: string;
  detail: string;
  icon: React.ReactNode;
  accent?: 'primary' | 'muted';
}) {
  return (
    <div className="flex items-start gap-3 rounded-[1.45rem] border border-border/55 bg-background/60 px-4 py-3">
      <div
        className={cn(
          'mt-0.5 rounded-full border p-2',
          accent === 'primary'
            ? 'border-primary/20 bg-primary/10 text-primary'
            : 'border-border/60 bg-muted/45 text-muted-foreground',
        )}
      >
        {icon}
      </div>
      <div className="min-w-0 flex-1 space-y-0.5">
        <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
          {label}
        </p>
        <p className="text-sm font-medium text-foreground">{value}</p>
        <p className="text-xs leading-relaxed text-muted-foreground">{detail}</p>
      </div>
    </div>
  );
}

function SummaryChip({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-[1.2rem] border border-border/55 bg-background/60 px-3 py-3">
      <p className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 text-sm font-medium text-foreground">{value}</p>
    </div>
  );
}

export default function DriverDashboardPage() {
  const { currentUser } = useStore();
  const { isDutyOn, setDutyIntent } = useDriverDutyIntent(
    currentUser?.role === 'driver' ? currentUser.id : null,
  );
  const [summary, setSummary] = useState<DriverSummaryData | null>(null);
  const [loading, setLoading] = useState(true);
  const [isTogglingDuty, setIsTogglingDuty] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [feedbackPrompt, setFeedbackPrompt] = useState<RideFeedbackPrompt | null>(null);
  const [isFeedbackModalOpen, setIsFeedbackModalOpen] = useState(false);
  const loadingRef = useRef(false);
  const feedbackPromptLoadedRef = useRef(false);

  const isDriver = currentUser?.role === 'driver';

  const loadSummary = useCallback(async () => {
    if (!isDriver || loadingRef.current) return;

    loadingRef.current = true;
    try {
      const response = await getDriverSummaryData();
      setSummary(response);
      setDutyIntent(response.presence.isOnline);
      setError(null);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to load driver home.',
      );
    } finally {
      loadingRef.current = false;
      setLoading(false);
    }
  }, [isDriver, setDutyIntent]);

  useEffect(() => {
    void loadSummary();
  }, [loadSummary]);

  useEffect(() => {
    if (!isDriver || feedbackPromptLoadedRef.current) {
      return;
    }

    feedbackPromptLoadedRef.current = true;
    const prompt = readRideFeedbackPrompt();
    if (prompt?.role !== 'driver') {
      return;
    }

    clearRideFeedbackPrompt();
    setFeedbackPrompt(prompt);
    setIsFeedbackModalOpen(true);
  }, [isDriver]);

  const toggleDuty = async () => {
    const nextValue = !isDutyOn;
    setIsTogglingDuty(true);
    setError(null);

    try {
      const response = await fetch('/api/bookings/driver/presence', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ isOnline: nextValue }),
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as {
          error?: string;
        };
        throw new Error(payload.error ?? 'Failed to update duty status.');
      }

      setDutyIntent(nextValue);
      await loadSummary();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to update duty status.',
      );
    } finally {
      setIsTogglingDuty(false);
    }
  };

  if (!currentUser || currentUser.role !== 'driver' || loading) {
    return (
      <PageLoadingState
        label="Loading driver home..."
        className="theme-driver min-h-screen bg-background text-foreground"
      />
    );
  }

  const stats = summary?.stats ?? {
    assignedCount: 0,
    ridesCompletedToday: 0,
    ridesCompletedTotal: 0,
    totalEarnings: 0,
    totalEarningsToday: 0,
    acceptanceRate: 100,
  };
  const activeRide = summary?.activeRide ?? null;
  const terminalContext = summary?.terminalContext ?? null;
  const stateContent = getHomeStateContent({
    isDutyOn,
    hasActiveRide: Boolean(activeRide),
    assignedCount: stats.assignedCount,
    terminalName: terminalContext?.name ?? null,
  });
  const showTodaySummary =
    stats.ridesCompletedToday > 0 || stats.totalEarningsToday > 0;

  return (
    <DriverAppShell>
      <RideFeedbackModal
        open={isFeedbackModalOpen && Boolean(feedbackPrompt)}
        onOpenChange={setIsFeedbackModalOpen}
        title="Rate your passenger"
        description="Leave a quick rating and note for the completed trip."
        subjectLabel="Passenger"
        subjectName={feedbackPrompt?.subjectName}
        onSubmit={async (input) => {
          if (!feedbackPrompt) return;
          await submitRideFeedback(feedbackPrompt.rideId, input);
          setIsFeedbackModalOpen(false);
          setFeedbackPrompt(null);
          await loadSummary();
        }}
      />
      <div className="space-y-5">
        <section className="space-y-4 rounded-[2rem] border border-primary/15 bg-primary/6 px-4 py-5">
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-1">
              <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                {stateContent.eyebrow}
              </p>
              <h1 className="text-2xl font-semibold tracking-tight text-foreground">
                {stateContent.title}
              </h1>
              <p className="text-sm leading-relaxed text-muted-foreground">
                {stateContent.copy}
              </p>
            </div>
            {activeRide ? (
              <StatusBadge status={activeRide.status} />
            ) : (
              <span
                className={cn(
                  'inline-flex rounded-full px-3 py-1 text-xs font-medium',
                  isDutyOn
                    ? 'bg-primary/14 text-primary'
                    : 'bg-muted text-muted-foreground',
                )}
              >
                {isDutyOn ? 'On duty' : 'Off duty'}
              </span>
            )}
          </div>

          <div className="space-y-3">
            <OperationalRow
              label="Duty state"
              value={isDutyOn ? 'On duty' : 'Off duty'}
              detail={
                isDutyOn
                  ? formatHeartbeatTime(summary?.presence.lastHeartbeatAt ?? null)
                  : 'Go on duty to become visible for terminal dispatch.'
              }
              icon={<Power className="h-4 w-4" />}
              accent={isDutyOn ? 'primary' : 'muted'}
            />

            <OperationalRow
              label="Assigned terminal"
              value={terminalContext?.name ?? 'No TODA assigned yet'}
              detail={
                terminalContext
                  ? `${terminalContext.location} • Queue now ${terminalContext.currentQueued}/${terminalContext.capacity}`
                  : 'Ask your tenant administrator to confirm your TODA or terminal assignment.'
              }
              icon={<MapPin className="h-4 w-4" />}
              accent={terminalContext ? 'primary' : 'muted'}
            />

            <OperationalRow
              label="Current assignment"
              value={
                activeRide
                  ? `${activeRide.pickupLocation} to ${activeRide.dropoffLocation}`
                  : stats.assignedCount > 0
                    ? `${stats.assignedCount} assigned ride${stats.assignedCount === 1 ? '' : 's'} waiting`
                    : 'No current assignment'
              }
              detail={
                activeRide
                  ? formatRideSubtitle(activeRide.status)
                  : isDutyOn
                    ? 'Stay ready. New matched rides will appear in Assigned when dispatch routes work to you.'
                    : 'You will start receiving matched rides only after you go on duty.'
              }
              icon={<Route className="h-4 w-4" />}
              accent={activeRide || stats.assignedCount > 0 ? 'primary' : 'muted'}
            />
          </div>

          <div className="grid gap-2 sm:grid-cols-2">
            <Button
              type="button"
              className="h-11 rounded-full bg-primary"
              disabled={isTogglingDuty}
              onClick={() => void toggleDuty()}
            >
              <Power className="mr-2 h-4 w-4" />
              {isTogglingDuty
                ? 'Updating duty...'
                : isDutyOn
                  ? 'Go Off Duty'
                  : 'Go On Duty'}
            </Button>

            <div className="grid grid-cols-2 gap-2">
              <Link href={activeRide ? '/driver/active-trip' : '/driver/assigned'}>
                <Button variant="outline" className="h-11 w-full rounded-full">
                  {activeRide ? 'Open Active' : 'Open Assigned'}
                </Button>
              </Link>
              <Link href={activeRide ? '/driver/assigned' : '/driver/toda'}>
                <Button variant="outline" className="h-11 w-full rounded-full">
                  {activeRide ? 'Assigned' : 'Open TODA'}
                </Button>
              </Link>
            </div>
          </div>
        </section>

        {error ? (
          <InlineErrorState
            message={error}
            onRetry={() => void loadSummary()}
          />
        ) : null}

        <section className="space-y-3 rounded-[1.85rem] border border-border/60 bg-background/58 px-4 py-4">
          <div className="flex items-center justify-between gap-3">
            <div className="space-y-1">
              <h2 className="text-sm font-semibold tracking-tight text-foreground">
                {activeRide ? 'Current assignment' : 'Waiting state'}
              </h2>
              <p className="text-xs text-muted-foreground">
                {activeRide
                  ? 'Keep the live trip moving from pickup to dropoff.'
                  : isDutyOn
                    ? 'You are ready for the next matched ride.'
                    : 'Turn duty on first before new matched rides can reach your account.'}
              </p>
            </div>
            {activeRide ? (
              <StatusBadge status={activeRide.status} />
            ) : (
              <span className="text-xs font-medium text-muted-foreground">
                {stats.assignedCount} assigned
              </span>
            )}
          </div>

          {activeRide ? (
            <div className="space-y-4">
              <div className="space-y-1">
                <p className="text-base font-medium text-foreground">
                  {activeRide.pickupLocation}
                </p>
                <p className="text-sm text-muted-foreground">
                  to {activeRide.dropoffLocation}
                </p>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <SummaryChip
                  label="Distance"
                  value={`${activeRide.distance} km`}
                />
                <SummaryChip
                  label="ETA"
                  value={`${activeRide.estimatedDuration} min`}
                />
                <SummaryChip
                  label="Fare"
                  value={formatCurrency(activeRide.fare)}
                />
              </div>

              <div className="grid gap-2 sm:grid-cols-2">
                <Link href="/driver/active-trip">
                  <Button className="h-11 w-full rounded-full">
                    Resume Active
                    <ArrowRight className="ml-1 h-4 w-4" />
                  </Button>
                </Link>
                <Link href="/driver/assigned">
                  <Button variant="outline" className="h-11 w-full rounded-full">
                    Open Assigned
                  </Button>
                </Link>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="rounded-[1.45rem] border border-dashed border-border/70 bg-background/60 px-4 py-4">
                <div className="flex items-start gap-3">
                  <div
                    className={cn(
                      'rounded-full border p-2',
                      isDutyOn
                        ? 'border-primary/20 bg-primary/10 text-primary'
                        : 'border-border/60 bg-muted/45 text-muted-foreground',
                    )}
                  >
                    <CheckCircle2 className="h-4 w-4" />
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-foreground">
                      {isDutyOn
                        ? 'Waiting for the next matched ride'
                        : 'You are not receiving dispatch yet'}
                    </p>
                    <p className="text-sm leading-relaxed text-muted-foreground">
                      {isDutyOn
                        ? 'Assigned rides will surface here and in Assigned as soon as dispatch routes one to you.'
                        : 'Go on duty when you are ready to start receiving matched rides.'}
                    </p>
                  </div>
                </div>
              </div>

              <div className="grid gap-2 sm:grid-cols-2">
                <Link href="/driver/assigned">
                  <Button variant="outline" className="h-11 w-full rounded-full">
                    Open Assigned
                  </Button>
                </Link>
                <Link href="/driver/toda">
                  <Button variant="outline" className="h-11 w-full rounded-full">
                    <ListOrdered className="mr-2 h-4 w-4" />
                    Open TODA
                  </Button>
                </Link>
              </div>
            </div>
          )}
        </section>

        {(terminalContext || showTodaySummary) && (
          <section className="space-y-3 rounded-[1.85rem] border border-border/60 bg-background/58 px-4 py-4">
            <div className="space-y-1">
              <h2 className="text-sm font-semibold tracking-tight text-foreground">
                Operational context
              </h2>
              <p className="text-xs text-muted-foreground">
                Keep terminal details and real same-day progress close to the duty controls.
              </p>
            </div>

            {terminalContext ? (
              <div className="rounded-[1.45rem] border border-border/55 bg-background/60 px-4 py-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1">
                    <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                      TODA / terminal
                    </p>
                    <p className="text-sm font-medium text-foreground">
                      {terminalContext.name}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {terminalContext.location}
                    </p>
                  </div>
                  <Link
                    href="/driver/toda"
                    className="text-xs font-medium text-primary transition-colors hover:text-primary/80"
                  >
                    Open TODA
                  </Link>
                </div>
              </div>
            ) : null}

            {showTodaySummary ? (
              <div className="grid grid-cols-2 gap-2">
                <SummaryChip
                  label="Today trips"
                  value={String(stats.ridesCompletedToday)}
                />
                <SummaryChip
                  label="Today earnings"
                  value={formatCurrency(stats.totalEarningsToday)}
                />
              </div>
            ) : null}

            {!showTodaySummary ? (
              <p className="text-xs text-muted-foreground">
                No completed rides yet for today.
              </p>
            ) : null}
          </section>
        )}
      </div>
    </DriverAppShell>
  );
}
