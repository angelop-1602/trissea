'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { Car, UserRound } from 'lucide-react';
import { BRAND_NAME } from '@/lib/brand';
import { Button } from '@/components/ui/button';
import { getPwaRoleFromPathname, writeStoredPwaRole, type PwaRole } from '@/lib/pwa-role';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

export function PwaInstallPrompt() {
  const pathname = usePathname();
  const [promptEvent, setPromptEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [isDismissed, setIsDismissed] = useState(false);
  const [installingRole, setInstallingRole] = useState<PwaRole | null>(null);
  const pathnameRole = getPwaRoleFromPathname(pathname);
  const isExactOnboardingRoot = pathname === '/passenger' || pathname === '/driver';
  const isLandingPage = pathname === '/' || pathname === '/landing';

  useEffect(() => {
    const onBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setPromptEvent(event as BeforeInstallPromptEvent);
    };

    window.addEventListener('beforeinstallprompt', onBeforeInstallPrompt);
    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstallPrompt);
    };
  }, []);

  if (isLandingPage || isExactOnboardingRoot || !promptEvent || isDismissed) {
    return null;
  }

  const onInstall = async (role: PwaRole) => {
    setInstallingRole(role);
    writeStoredPwaRole(role);

    try {
      await promptEvent.prompt();
      const choice = await promptEvent.userChoice;
      if (choice.outcome !== 'accepted') {
        setIsDismissed(true);
      }
    } catch {
      setIsDismissed(true);
    } finally {
      setPromptEvent(null);
      setInstallingRole(null);
    }
  };

  if (pathnameRole) {
    const label = pathnameRole === 'passenger' ? 'Passenger' : 'Driver';
    const Icon = pathnameRole === 'passenger' ? UserRound : Car;

    return (
      <div className="fixed bottom-4 left-1/2 z-[60] w-[min(92vw,28rem)] -translate-x-1/2 rounded-lg border bg-background/95 p-3 shadow-lg backdrop-blur">
        <p className="text-sm font-medium">Install {BRAND_NAME} {label}</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Add this role-specific app entry to your home screen.
        </p>
        <div className="mt-3 flex gap-2">
          <Button
            size="sm"
            onClick={() => void onInstall(pathnameRole)}
            disabled={installingRole !== null}
          >
            <Icon className="h-4 w-4" />
            {installingRole === pathnameRole ? 'Installing...' : `Install ${label}`}
          </Button>
          <Button size="sm" variant="outline" onClick={() => setIsDismissed(true)}>
            Not now
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed bottom-4 left-1/2 z-[60] w-[min(92vw,28rem)] -translate-x-1/2 rounded-lg border bg-background/95 p-3 shadow-lg backdrop-blur">
      <p className="text-sm font-medium">How will you use {BRAND_NAME}?</p>
      <p className="mt-1 text-xs text-muted-foreground">
        Choose the app entry you want to install.
      </p>
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        <Button
          size="sm"
          className="justify-start"
          onClick={() => void onInstall('passenger')}
          disabled={installingRole !== null}
        >
          <UserRound className="h-4 w-4" />
          {installingRole === 'passenger' ? 'Installing...' : 'Passenger'}
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="justify-start"
          onClick={() => void onInstall('driver')}
          disabled={installingRole !== null}
        >
          <Car className="h-4 w-4" />
          {installingRole === 'driver' ? 'Installing...' : 'Driver'}
        </Button>
      </div>
      <div className="mt-2 flex justify-end">
        <Button size="sm" variant="outline" onClick={() => setIsDismissed(true)}>
          Not now
        </Button>
      </div>
    </div>
  );
}
