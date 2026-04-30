'use client';

import { useEffect, useState } from 'react';
import type { User } from '@prisma/client';
import { DriverAppShell } from '@/components/driver/driver-app-shell';
import { InlineErrorState, PageLoadingState } from '@/components/page-state';
import { AccountSection } from '@/components/passenger/account-section';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useDriverAccountData } from '@/hooks/use-driver-account-data';
import { updateDriverAccountProfile } from '@/lib/driver-account-client';
import { formatDriverAccountDate } from '@/lib/driver-account-presenters';
import { useStore } from '@/lib/store-context';

export default function DriverProfilePage() {
  const { data, loading, error, reload, setData } = useDriverAccountData();
  const { currentUser, setCurrentUser } = useStore();
  const [contactEmail, setContactEmail] = useState('');
  const [homeAddress, setHomeAddress] = useState('');
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    if (!data) return;

    setContactEmail(data.profile.contactEmail ?? data.user.email ?? '');
    setHomeAddress(data.profile.homeAddress ?? '');
  }, [data]);

  const handleSave = async () => {
    setSaving(true);
    setNotice(null);
    setSaveError(null);

    try {
      const nextData = await updateDriverAccountProfile({
        contactEmail: contactEmail || null,
        homeAddress: homeAddress || null,
      });

      setData(nextData);
      if (currentUser) {
        setCurrentUser({
          ...currentUser,
          email: nextData.user.email,
        } as User);
      }
      setNotice('Profile details updated.');
    } catch (err) {
      setSaveError(
        err instanceof Error ? err.message : 'Failed to update driver profile.',
      );
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <PageLoadingState
        label="Loading driver profile..."
        className="theme-driver min-h-screen bg-background text-foreground"
      />
    );
  }

  return (
    <DriverAppShell
      title="Profile"
      subtitle="Only the real self-service driver fields available today can be edited here."
      backHref="/driver/account"
      topContext="Account"
      headerVariant="compact"
      headerSurface="minimal"
    >
      {error ? <InlineErrorState message={error} onRetry={() => void reload()} /> : null}
      {saveError ? <InlineErrorState message={saveError} /> : null}

      {data ? (
        <>
          <AccountSection
            title="Editable contact details"
            description="These are the supported driver profile fields you can manage yourself today."
          >
            <div className="space-y-4 px-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="driver-contact-email">Contact email</Label>
                <Input
                  id="driver-contact-email"
                  type="email"
                  value={contactEmail}
                  onChange={(event) => setContactEmail(event.target.value)}
                  placeholder="Add your contact email"
                  className="rounded-2xl"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="driver-home-address">Home address</Label>
                <Textarea
                  id="driver-home-address"
                  value={homeAddress}
                  onChange={(event) => setHomeAddress(event.target.value)}
                  placeholder="Add your current home address"
                  className="min-h-24 rounded-2xl"
                />
              </div>

              {notice ? <p className="text-sm text-muted-foreground">{notice}</p> : null}

              <Button
                className="h-11 w-full rounded-full"
                onClick={() => void handleSave()}
                disabled={saving}
              >
                {saving ? 'Saving...' : 'Save Profile'}
              </Button>
            </div>
          </AccountSection>

          <AccountSection
            title="Identity on file"
            description="These fields are stored on your account but stay read-only here because they affect verification or sign-in."
          >
            <div className="space-y-4 px-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="driver-legal-name">Legal full name</Label>
                <Input
                  id="driver-legal-name"
                  value={data.profile.legalFullName ?? data.user.name}
                  readOnly
                  className="rounded-2xl bg-muted/30"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="driver-phone">Mobile number</Label>
                <Input
                  id="driver-phone"
                  value={data.profile.contactPhone ?? data.user.phone ?? ''}
                  readOnly
                  className="rounded-2xl bg-muted/30"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="driver-dob">Date of birth</Label>
                <Input
                  id="driver-dob"
                  value={formatDriverAccountDate(data.profile.dateOfBirth)}
                  readOnly
                  className="rounded-2xl bg-muted/30"
                />
              </div>

              <p className="text-xs leading-relaxed text-muted-foreground">
                Legal name, mobile number, and birth date are admin-controlled in
                this phase. Contact your tenant administrator if these details
                need correction.
              </p>
            </div>
          </AccountSection>
        </>
      ) : null}
    </DriverAppShell>
  );
}
