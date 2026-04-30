'use client';

import { useCallback, useEffect, useState } from 'react';

const DRIVER_DUTY_EVENT = 'trissea:driver-duty-intent';

function getDriverDutyStorageKey(driverId: string) {
  return `trissea:driver-duty:${driverId}`;
}

function readDriverDutyIntent(storageKey: string) {
  if (typeof window === 'undefined') return false;

  const raw = window.localStorage.getItem(storageKey);
  return raw === 'true';
}

function persistDriverDutyIntent(storageKey: string, nextValue: boolean) {
  if (typeof window === 'undefined') return;

  window.localStorage.setItem(storageKey, String(nextValue));
  window.dispatchEvent(
    new CustomEvent(DRIVER_DUTY_EVENT, {
      detail: {
        storageKey,
        value: nextValue,
      },
    }),
  );
}

export function useDriverDutyIntent(driverId?: string | null) {
  const [isDutyOn, setIsDutyOn] = useState(false);

  useEffect(() => {
    if (!driverId || typeof window === 'undefined') {
      setIsDutyOn(false);
      return;
    }

    const storageKey = getDriverDutyStorageKey(driverId);
    const syncFromStorage = () => {
      setIsDutyOn(readDriverDutyIntent(storageKey));
    };

    syncFromStorage();

    const handleStorage = (event: StorageEvent) => {
      if (event.key === storageKey) {
        syncFromStorage();
      }
    };

    const handleIntentEvent = (event: Event) => {
      const detail = (event as CustomEvent<{ storageKey?: string }>).detail;
      if (detail?.storageKey === storageKey) {
        syncFromStorage();
      }
    };

    window.addEventListener('storage', handleStorage);
    window.addEventListener(DRIVER_DUTY_EVENT, handleIntentEvent);

    return () => {
      window.removeEventListener('storage', handleStorage);
      window.removeEventListener(DRIVER_DUTY_EVENT, handleIntentEvent);
    };
  }, [driverId]);

  const updateDutyIntent = useCallback(
    (nextValue: boolean) => {
      if (!driverId) {
        setIsDutyOn(nextValue);
        return;
      }

      persistDriverDutyIntent(getDriverDutyStorageKey(driverId), nextValue);
      setIsDutyOn(nextValue);
    },
    [driverId],
  );

  return {
    isDutyOn,
    setDutyIntent: updateDutyIntent,
  };
}

