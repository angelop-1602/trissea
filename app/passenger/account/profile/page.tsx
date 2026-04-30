'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { User } from '@prisma/client';
import { useStore } from '@/lib/store-context';
import { PassengerAppShell } from '@/components/passenger/passenger-app-shell';
import { InlineErrorState, PageLoadingState } from '@/components/page-state';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { getPassengerAccount, updatePassengerAccount } from '@/lib/passenger-account-client';
import { AccountSection } from '@/components/passenger/account-section';

export default function PassengerProfilePage() {
  const { currentUser, setCurrentUser } = useStore();
  const [name, setName] = useState(currentUser?.name ?? '');
  const [email, setEmail] = useState(currentUser?.email ?? '');
  const [phone, setPhone] = useState(currentUser?.phone ?? '');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const loadingRef = useRef(false);

  const loadProfile = useCallback(async () => {
    if (loadingRef.current) return;
    loadingRef.current = true;

    try {
      const user = await getPassengerAccount();
      setName(user.name ?? '');
      setEmail(user.email ?? '');
      setPhone(user.phone ?? '');
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load profile.');
    } finally {
      loadingRef.current = false;
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadProfile();
  }, [loadProfile]);

  const handleSave = async () => {
    setSaving(true);
    setNotice(null);
    setError(null);

    try {
      const updatedUser = await updatePassengerAccount({
        name,
        email: email || null,
      });

      if (currentUser) {
        setCurrentUser({ ...currentUser, ...updatedUser } as User);
      }
      setNotice('Profile updated.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save profile.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <PageLoadingState
        label="Loading passenger profile..."
        tone="passenger"
      />
    );
  }

  return (
    <PassengerAppShell
      title="Profile"
      subtitle="Update the real identity details stored on your passenger account."
      backHref="/passenger/account"
      topContext="Account"
      headerVariant="compact"
      headerSurface="minimal"
    >
      {error ? <InlineErrorState message={error} onRetry={() => void loadProfile()} /> : null}

      <AccountSection
        title="Profile details"
        description="Phone stays read-only because it is tied to your OTP sign-in identity."
      >
        <div className="space-y-4 px-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="profile-name">Full name</Label>
            <Input
              id="profile-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Enter your full name"
              className="rounded-2xl"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="profile-phone">Mobile number</Label>
            <Input id="profile-phone" value={phone} readOnly className="rounded-2xl bg-muted/30" />
          </div>

          <div className="space-y-2">
            <Label htmlFor="profile-email">Email</Label>
            <Input
              id="profile-email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="Add your email"
              className="rounded-2xl"
            />
          </div>

          {notice ? <p className="text-sm text-muted-foreground">{notice}</p> : null}

          <Button className="h-11 w-full rounded-full" onClick={() => void handleSave()} disabled={saving}>
            {saving ? 'Saving...' : 'Save Profile'}
          </Button>
        </div>
      </AccountSection>
    </PassengerAppShell>
  );
}
