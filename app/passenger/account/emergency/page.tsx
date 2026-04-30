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

export default function PassengerEmergencyContactPage() {
  const { currentUser, setCurrentUser } = useStore();
  const [contactName, setContactName] = useState(currentUser?.emergencyContactName ?? '');
  const [contactPhone, setContactPhone] = useState(currentUser?.emergencyContactPhone ?? '');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const loadingRef = useRef(false);

  const loadEmergencyContact = useCallback(async () => {
    if (loadingRef.current) return;
    loadingRef.current = true;

    try {
      const user = await getPassengerAccount();
      setContactName(user.emergencyContactName ?? '');
      setContactPhone(user.emergencyContactPhone ?? '');
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load emergency contact.');
    } finally {
      loadingRef.current = false;
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadEmergencyContact();
  }, [loadEmergencyContact]);

  const handleSave = async () => {
    setSaving(true);
    setNotice(null);
    setError(null);

    try {
      const updatedUser = await updatePassengerAccount({
        emergencyContactName: contactName || null,
        emergencyContactPhone: contactPhone || null,
      });

      if (currentUser) {
        setCurrentUser({ ...currentUser, ...updatedUser } as User);
      }
      setNotice('Emergency contact updated.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save emergency contact.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <PageLoadingState
        label="Loading emergency contact..."
        tone="passenger"
      />
    );
  }

  return (
    <PassengerAppShell
      title="Emergency Contact"
      subtitle="Keep one practical emergency contact on your passenger account."
      backHref="/passenger/account"
      topContext="Account"
      headerVariant="compact"
      headerSurface="minimal"
    >
      {error ? <InlineErrorState message={error} onRetry={() => void loadEmergencyContact()} /> : null}

      <AccountSection
        title="Emergency contact details"
        description="These are the same emergency fields collected during passenger sign up."
      >
        <div className="space-y-4 px-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="emergency-name">Contact name</Label>
            <Input
              id="emergency-name"
              value={contactName}
              onChange={(event) => setContactName(event.target.value)}
              placeholder="Enter contact name"
              className="rounded-2xl"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="emergency-phone">Contact phone</Label>
            <Input
              id="emergency-phone"
              value={contactPhone}
              onChange={(event) => setContactPhone(event.target.value)}
              placeholder="Enter contact phone"
              className="rounded-2xl"
            />
          </div>

          {notice ? <p className="text-sm text-muted-foreground">{notice}</p> : null}

          <Button className="h-11 w-full rounded-full" onClick={() => void handleSave()} disabled={saving}>
            {saving ? 'Saving...' : 'Save Emergency Contact'}
          </Button>
        </div>
      </AccountSection>
    </PassengerAppShell>
  );
}
