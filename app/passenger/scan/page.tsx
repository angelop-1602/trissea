'use client';

import Link from 'next/link';
import { BadgeCheck, Camera, MapPinned, QrCode, ShieldCheck } from 'lucide-react';
import { PassengerAppShell } from '@/components/passenger/passenger-app-shell';
import { Button } from '@/components/ui/button';

const scanDetails = [
  {
    label: 'Verified driver profile',
    icon: BadgeCheck,
  },
  {
    label: 'Tricycle and plate details',
    icon: QrCode,
  },
  {
    label: 'TODA assignment',
    icon: ShieldCheck,
  },
];

export default function PassengerScanPage() {
  return (
    <PassengerAppShell
      title="Scan"
      subtitle="Check driver details from a QR code."
      topContext="Scan"
      headerVariant="compact"
      headerSurface="minimal"
    >
      <section className="space-y-5 rounded-[1.8rem] border border-primary/15 bg-primary/[0.06] px-4 py-5">
        <div className="mx-auto flex h-40 w-40 items-center justify-center rounded-[2rem] border border-primary/20 bg-background/80">
          <div className="flex h-28 w-28 items-center justify-center rounded-[1.5rem] border-2 border-dashed border-primary/45 text-primary">
            <QrCode className="h-14 w-14" />
          </div>
        </div>

        <div className="space-y-2 text-center">
          <h1 className="text-xl font-semibold tracking-tight">Scan driver QR</h1>
          <p className="mx-auto max-w-xs text-sm text-muted-foreground">
            This will help passengers confirm the driver and tricycle before the ride.
          </p>
        </div>

        <div className="divide-y divide-border/60 rounded-[1.35rem] border border-border/60 bg-background/70">
          {scanDetails.map((item) => {
            const Icon = item.icon;

            return (
              <div key={item.label} className="flex items-center gap-3 px-4 py-3 text-sm">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <Icon className="h-4 w-4" />
                </span>
                <span className="font-medium">{item.label}</span>
              </div>
            );
          })}
        </div>

        <div className="grid gap-2">
          <Button className="h-11 rounded-full" disabled>
            <Camera className="mr-2 h-4 w-4" />
            Scanner coming soon
          </Button>
          <Link href="/passenger/on-demand">
            <Button variant="outline" className="h-11 w-full rounded-full">
              <MapPinned className="mr-2 h-4 w-4" />
              Book instead
            </Button>
          </Link>
        </div>
      </section>
    </PassengerAppShell>
  );
}
