'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  getDriverAccount,
  type DriverAccountData,
} from '@/lib/driver-account-client';

export function useDriverAccountData() {
  const [data, setData] = useState<DriverAccountData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const loadingRef = useRef(false);

  const reload = useCallback(async () => {
    if (loadingRef.current) return;

    loadingRef.current = true;
    try {
      const nextData = await getDriverAccount();
      setData(nextData);
      setError(null);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to load driver account.',
      );
    } finally {
      loadingRef.current = false;
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  return {
    data,
    loading,
    error,
    reload,
    setData,
  };
}
