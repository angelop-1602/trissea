'use client';

import { useEffect } from 'react';

export function RegisterServiceWorker() {
  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
      return;
    }

    if (process.env.NODE_ENV !== 'production') {
      // Prevent stale local bundles from being served by an old SW in development.
      void navigator.serviceWorker.getRegistrations().then((registrations) => {
        for (const registration of registrations) {
          void registration.unregister();
        }
      });

      if ('caches' in window) {
        void caches.keys().then((keys) => {
          for (const key of keys) {
            if (key.startsWith('mobility-shell-')) {
              void caches.delete(key);
            }
          }
        });
      }

      return;
    }

    void navigator.serviceWorker.register('/sw.js').then((registration) => {
      void registration.update();
    });
  }, []);

  return null;
}
