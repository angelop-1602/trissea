'use client';

import { OfflineBanner } from '@/components/pwa/offline-banner';
import { PwaInstallPrompt } from '@/components/pwa/install-prompt';
import { RegisterServiceWorker } from '@/components/pwa/register-sw';

export function PwaClient() {
  return (
    <>
      <RegisterServiceWorker />
      <OfflineBanner />
      <PwaInstallPrompt />
    </>
  );
}
