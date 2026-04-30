'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppHeader } from '@/components/app-header';
import { PageHeader } from '@/components/admin/page-header';
import { SummaryStrip } from '@/components/admin/summary-strip';
import { TableSurface } from '@/components/admin/table-surface';
import {
  ListCardSkeleton,
  PageHeaderSkeleton,
  StatsCardsSkeleton,
} from '@/components/dashboard/loading-skeletons';
import { InlineErrorState } from '@/components/page-state';
import { SidebarLayout } from '@/components/sidebar-layout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PendingButtonContent } from '@/components/ui/pending-button-content';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import {
  getSuperadminPassengerProfile,
  type SuperadminPassengerProfileData,
  updateSuperadminPassengerProfile,
} from '@/lib/dashboard/client';
import { useStore } from '@/lib/store-context';
import { getSuperadminSidebarItems } from '@/lib/superadmin-navigation';

function formatCurrency(value: number) {
  return new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: 'PHP',
    maximumFractionDigits: 0,
  }).format(value);
}

function formatDateTime(value: string | Date | null | undefined) {
  if (!value) return 'Unavailable';
  return new Date(value).toLocaleString();
}

export default function SuperadminPassengerProfilePage() {
  const { currentUser } = useStore();
  const params = useParams<{ passengerId: string }>();
  const passengerId = Array.isArray(params?.passengerId) ? params.passengerId[0] : params?.passengerId;
  const [data, setData] = useState<SuperadminPassengerProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const loadingRef = useRef(false);
  const [draft, setDraft] = useState({
    name: '',
    email: '',
    emergencyContactName: '',
    emergencyContactPhone: '',
    reason: '',
  });

  const canLoad = currentUser?.role === 'superadmin' && Boolean(passengerId);
  const sidebarItems = useMemo(() => getSuperadminSidebarItems(), []);

  const loadData = useCallback(async () => {
    if (!canLoad || !passengerId || loadingRef.current) return;
    loadingRef.current = true;

    try {
      const response = await getSuperadminPassengerProfile(passengerId);
      setData(response);
      setDraft({
        name: response.passenger.name,
        email: response.passenger.email ?? '',
        emergencyContactName: response.passenger.emergencyContactName ?? '',
        emergencyContactPhone: response.passenger.emergencyContactPhone ?? '',
        reason: '',
      });
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load passenger profile.');
    } finally {
      loadingRef.current = false;
      setLoading(false);
    }
  }, [canLoad, passengerId]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const handleSave = async () => {
    if (!passengerId || draft.reason.trim().length < 5 || saving) return;

    setSaving(true);
    setError(null);
    setNotice(null);

    try {
      await updateSuperadminPassengerProfile(passengerId, {
        name: draft.name,
        email: draft.email.trim() || null,
        emergencyContactName: draft.emergencyContactName.trim() || null,
        emergencyContactPhone: draft.emergencyContactPhone.trim() || null,
        reason: draft.reason.trim(),
      });
      setNotice('Passenger profile corrected.');
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save passenger profile.');
    } finally {
      setSaving(false);
    }
  };

  if (!currentUser || currentUser.role !== 'superadmin' || !passengerId) {
    return (
      <div className="space-y-6 p-6">
        <PageHeaderSkeleton withAction />
        <StatsCardsSkeleton count={4} />
        <ListCardSkeleton itemCount={4} />
      </div>
    );
  }

  const passenger = data?.passenger;
  const activeRide = data?.activeRide ?? null;
  const activeReservations = data?.activeReservations ?? [];
  const rides = data?.rides ?? [];
  const reservations = data?.reservations ?? [];

  return (
    <>
      <AppHeader />
      <div className="mx-auto max-w-7xl px-4 pb-8">
        <SidebarLayout title="Superadmin Menu" items={sidebarItems}>
          <div className="space-y-6">
            {loading ? (
              <>
                <PageHeaderSkeleton withAction />
                <StatsCardsSkeleton count={4} className="md:grid-cols-2 xl:grid-cols-4" />
                <ListCardSkeleton itemCount={6} />
              </>
            ) : !data || !passenger ? (
              <InlineErrorState
                message={error ?? 'Passenger details were not found.'}
                onRetry={() => void loadData()}
                retryLabel="Retry passenger details"
              />
            ) : (
              <>
                <PageHeader
                  eyebrow="Passenger Oversight"
                  title={passenger.name}
                  description={
                    passenger.tenant
                      ? `${passenger.tenant.name} | ${passenger.tenant.lguName} | ${passenger.phone ?? 'No phone on file'}`
                      : passenger.phone ?? 'No phone on file'
                  }
                  actions={
                    <>
                      {passenger.tenant ? (
                        <Button asChild variant="outline">
                          <Link href={`/superadmin/tenants/${passenger.tenant.id}`}>Open Tenant</Link>
                        </Button>
                      ) : null}
                      <Button asChild variant="outline">
                        <Link href="/superadmin/passengers">Back to Passengers</Link>
                      </Button>
                    </>
                  }
                />

                {notice ? (
                  <p className="rounded-xl border border-primary/25 bg-primary/10 px-4 py-3 text-sm text-primary">
                    {notice}
                  </p>
                ) : null}

                {error ? (
                  <InlineErrorState
                    message={error}
                    onRetry={() => void loadData()}
                    retryLabel="Retry passenger details"
                  />
                ) : null}

                <SummaryStrip
                  items={[
                    { label: 'Total Rides', value: data.stats.totalRides },
                    { label: 'Completed', value: data.stats.completedRides },
                    { label: 'Reservations', value: data.stats.totalReservations },
                    { label: 'Total Spent', value: formatCurrency(data.stats.totalSpent), emphasized: true },
                  ]}
                />

                <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
                  <div className="space-y-6">
                    <TableSurface
                      title="Profile Corrections"
                      description="Superadmin can correct passenger profile fields, but trip and reservation records stay read-only."
                    >
                      <div className="space-y-4">
                        <div className="space-y-2">
                          <Label htmlFor="passenger-name">Name</Label>
                          <Input
                            id="passenger-name"
                            value={draft.name}
                            onChange={(event) =>
                              setDraft((current) => ({ ...current, name: event.target.value }))
                            }
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="passenger-email">Email</Label>
                          <Input
                            id="passenger-email"
                            type="email"
                            value={draft.email}
                            onChange={(event) =>
                              setDraft((current) => ({ ...current, email: event.target.value }))
                            }
                            placeholder="No email on file"
                          />
                        </div>
                        <div className="grid gap-4 md:grid-cols-2">
                          <div className="space-y-2">
                            <Label htmlFor="passenger-emergency-name">Emergency Contact Name</Label>
                            <Input
                              id="passenger-emergency-name"
                              value={draft.emergencyContactName}
                              onChange={(event) =>
                                setDraft((current) => ({
                                  ...current,
                                  emergencyContactName: event.target.value,
                                }))
                              }
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="passenger-emergency-phone">Emergency Contact Phone</Label>
                            <Input
                              id="passenger-emergency-phone"
                              value={draft.emergencyContactPhone}
                              onChange={(event) =>
                                setDraft((current) => ({
                                  ...current,
                                  emergencyContactPhone: event.target.value,
                                }))
                              }
                            />
                          </div>
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="passenger-reason">Audit Reason</Label>
                          <Textarea
                            id="passenger-reason"
                            value={draft.reason}
                            onChange={(event) =>
                              setDraft((current) => ({ ...current, reason: event.target.value }))
                            }
                            rows={4}
                            placeholder="Explain why this passenger profile correction is needed."
                          />
                        </div>
                        <div className="flex justify-end">
                          <Button
                            onClick={() => void handleSave()}
                            disabled={saving || draft.reason.trim().length < 5}
                          >
                            <PendingButtonContent pending={saving} label="Save Corrections" />
                          </Button>
                        </div>
                      </div>
                    </TableSurface>

                    <TableSurface
                      title="Identity Snapshot"
                      description="Current passenger identity, acceptance, and tenancy context."
                    >
                      <div className="grid gap-4 md:grid-cols-2">
                        <div className="rounded-xl border px-4 py-3">
                          <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Phone</p>
                          <p className="mt-2 text-sm">{passenger.phone ?? 'No phone on file'}</p>
                        </div>
                        <div className="rounded-xl border px-4 py-3">
                          <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Phone E164</p>
                          <p className="mt-2 text-sm">{passenger.phoneE164 ?? 'Not normalized'}</p>
                        </div>
                        <div className="rounded-xl border px-4 py-3">
                          <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Tenant</p>
                          <p className="mt-2 text-sm">
                            {passenger.tenant ? (
                              <Link
                                href={`/superadmin/tenants/${passenger.tenant.id}`}
                                className="text-primary hover:underline"
                              >
                                {passenger.tenant.name}
                              </Link>
                            ) : (
                              'No tenant assigned'
                            )}
                          </p>
                        </div>
                        <div className="rounded-xl border px-4 py-3">
                          <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Terms Accepted</p>
                          <p className="mt-2 text-sm">{formatDateTime(passenger.termsAcceptedAt)}</p>
                        </div>
                        <div className="rounded-xl border px-4 py-3">
                          <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Balance</p>
                          <p className="mt-2 text-sm">{formatCurrency(passenger.balance)}</p>
                        </div>
                        <div className="rounded-xl border px-4 py-3">
                          <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Created</p>
                          <p className="mt-2 text-sm">{formatDateTime(passenger.createdAt)}</p>
                        </div>
                      </div>
                    </TableSurface>
                  </div>

                  <div className="space-y-6">
                    <TableSurface
                      title="Active Ride"
                      description="The passenger's current on-demand trip, if one is active."
                    >
                      {activeRide ? (
                        <div className="grid gap-4 md:grid-cols-2">
                          <div className="rounded-xl border px-4 py-3 md:col-span-2">
                            <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Route</p>
                            <p className="mt-2 text-sm">
                              {activeRide.pickupLocation} to {activeRide.dropoffLocation}
                            </p>
                          </div>
                          <div className="rounded-xl border px-4 py-3">
                            <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Status</p>
                            <p className="mt-2 text-sm">{activeRide.status}</p>
                          </div>
                          <div className="rounded-xl border px-4 py-3">
                            <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Fare</p>
                            <p className="mt-2 text-sm">{formatCurrency(activeRide.fare)}</p>
                          </div>
                          <div className="rounded-xl border px-4 py-3">
                            <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Driver</p>
                            <p className="mt-2 text-sm">
                              {activeRide.driver?.name ?? 'Unassigned'}
                              {activeRide.driver?.phone ? ` | ${activeRide.driver.phone}` : ''}
                            </p>
                          </div>
                          <div className="rounded-xl border px-4 py-3">
                            <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Terminal</p>
                            <p className="mt-2 text-sm">
                              {activeRide.terminal
                                ? `${activeRide.terminal.name} | ${activeRide.terminal.location}`
                                : 'No terminal'}
                            </p>
                          </div>
                        </div>
                      ) : (
                        <div className="py-6 text-sm text-muted-foreground">No active ride for this passenger.</div>
                      )}
                    </TableSurface>

                    <TableSurface
                      title="Active Reservations"
                      description="Current terminal reservations that still need action or boarding."
                      bodyClassName="pt-0"
                    >
                      {activeReservations.length === 0 ? (
                        <div className="py-6 text-sm text-muted-foreground">
                          No active reservations for this passenger.
                        </div>
                      ) : (
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Terminal</TableHead>
                              <TableHead>Status</TableHead>
                              <TableHead>Queue</TableHead>
                              <TableHead>Boarding</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {activeReservations.map((reservation) => (
                              <TableRow key={reservation.id}>
                                <TableCell>
                                  <div className="space-y-1">
                                    <p className="font-medium">{reservation.terminal.name}</p>
                                    <p className="text-xs text-muted-foreground">
                                      {reservation.terminal.location}
                                    </p>
                                  </div>
                                </TableCell>
                                <TableCell>{reservation.status}</TableCell>
                                <TableCell>{reservation.queuePosition}</TableCell>
                                <TableCell>{formatDateTime(reservation.boardingTime)}</TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      )}
                    </TableSurface>
                  </div>
                </div>

                <TableSurface
                  title="Ride History"
                  description="Read-only trip history across completed, active, and cancelled rides."
                  bodyClassName="pt-0"
                >
                  {rides.length === 0 ? (
                    <div className="py-8 text-sm text-muted-foreground">This passenger has no rides yet.</div>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Route</TableHead>
                          <TableHead>Driver</TableHead>
                          <TableHead>Terminal</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Fare</TableHead>
                          <TableHead>Created</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {rides.map((ride) => (
                          <TableRow key={ride.id}>
                            <TableCell>
                              <div className="space-y-1">
                                <p className="font-medium">{ride.pickupLocation}</p>
                                <p className="text-xs text-muted-foreground">to {ride.dropoffLocation}</p>
                              </div>
                            </TableCell>
                            <TableCell>{ride.driver?.name ?? 'Unassigned'}</TableCell>
                            <TableCell>{ride.terminal?.name ?? 'No terminal'}</TableCell>
                            <TableCell>{ride.status}</TableCell>
                            <TableCell>{formatCurrency(ride.fare)}</TableCell>
                            <TableCell>{formatDateTime(ride.createdAt)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </TableSurface>

                <TableSurface
                  title="Reservation History"
                  description="Read-only reservation visibility including queue timing and boarding state."
                  bodyClassName="pt-0"
                >
                  {reservations.length === 0 ? (
                    <div className="py-8 text-sm text-muted-foreground">
                      This passenger has no reservations yet.
                    </div>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Terminal</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Queue</TableHead>
                          <TableHead>Boarding</TableHead>
                          <TableHead>Created</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {reservations.map((reservation) => (
                          <TableRow key={reservation.id}>
                            <TableCell>
                              <div className="space-y-1">
                                <p className="font-medium">{reservation.terminal.name}</p>
                                <p className="text-xs text-muted-foreground">
                                  {reservation.terminal.location}
                                </p>
                              </div>
                            </TableCell>
                            <TableCell>{reservation.status}</TableCell>
                            <TableCell>{reservation.queuePosition}</TableCell>
                            <TableCell>{formatDateTime(reservation.boardingTime)}</TableCell>
                            <TableCell>{formatDateTime(reservation.createdAt)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </TableSurface>
              </>
            )}
          </div>
        </SidebarLayout>
      </div>
    </>
  );
}
