'use client';

import { useEffect, useState } from 'react';

export function OfflineBanner() {
  const [isOffline, setIsOffline] = useState(false);

  useEffect(() => {
    setIsOffline(!navigator.onLine);

    const onOnline = () => setIsOffline(false);
    const onOffline = () => setIsOffline(true);

    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);

    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, []);

  if (!isOffline) {
    return null;
  }

  return (
    <div className="fixed inset-x-0 top-0 z-[60] bg-brand px-4 py-2 text-center text-xs font-medium text-brand-foreground">
      You are offline. Actions that require network may fail until connection is restored.
    </div>
  );
}
