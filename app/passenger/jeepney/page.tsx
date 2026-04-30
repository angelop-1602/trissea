import Link from 'next/link';
import { BusFront, CarFront } from 'lucide-react';
import { PassengerAppShell } from '@/components/passenger/passenger-app-shell';
import { Button } from '@/components/ui/button';

export default function PassengerJeepneyPage() {
  return (
    <PassengerAppShell
      title="Jeepney"
      subtitle="This passenger module is prepared but not live yet."
      backHref="/passenger/modules"
      topContext="Jeepney"
      headerVariant="compact"
      headerSurface="minimal"
    >
      <section className="rounded-[2rem] border border-primary/15 bg-primary/[0.07] px-4 py-5">
        <div className="flex items-start gap-3">
          <div className="rounded-full border border-primary/20 bg-primary/10 p-2 text-primary">
            <BusFront className="h-5 w-5" />
          </div>
          <div className="space-y-1">
            <h1 className="text-2xl font-semibold tracking-tight">Jeepney module is being prepared</h1>
            <p className="text-sm text-muted-foreground">
              The platform can now recognize jeepney as a separate transport module, but the passenger booking flow for routes, departures, and stop-pair seats is not live yet.
            </p>
          </div>
        </div>
      </section>

      <section className="rounded-[1.7rem] border border-border/60 bg-background/60 px-4 py-4">
        <p className="text-sm font-medium text-foreground">What exists now</p>
        <p className="mt-2 text-sm text-muted-foreground">
          The module entry, routing boundary, and platform groundwork are in place so jeepney can be added without forcing it into the tricycle ride and TODA models.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Link href="/passenger/modules" className="flex-1 min-w-[10rem]">
            <Button variant="outline" className="h-11 w-full rounded-full">
              Back to Modules
            </Button>
          </Link>
          <Link href="/passenger/tricycle" className="flex-1 min-w-[10rem]">
            <Button className="h-11 w-full rounded-full">
              <CarFront className="mr-2 h-4 w-4" />
              Open Tricycle
            </Button>
          </Link>
        </div>
      </section>
    </PassengerAppShell>
  );
}
