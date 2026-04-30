import Link from 'next/link';
import { BusFront, CarFront } from 'lucide-react';
import { DriverAppShell } from '@/components/driver/driver-app-shell';
import { Button } from '@/components/ui/button';

export default function DriverJeepneyPage() {
  return (
    <DriverAppShell
      title="Jeepney"
      subtitle="This driver module is prepared but not live yet."
      backHref="/driver/modules"
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
            <h1 className="text-2xl font-semibold tracking-tight">Jeepney driver workspace is not live yet</h1>
            <p className="text-sm text-muted-foreground">
              The platform can now separate jeepney from tricycle at the module level, but jeepney departure operations, manifests, and boarding tools still need to be built.
            </p>
          </div>
        </div>
      </section>

      <section className="rounded-[1.7rem] border border-border/60 bg-background/60 px-4 py-4">
        <p className="text-sm font-medium text-foreground">What exists now</p>
        <p className="mt-2 text-sm text-muted-foreground">
          Module-aware routing and workspace boundaries are ready, so later jeepney work can ship as a distinct driver flow instead of being mixed into TODA dispatch and tricycle ride execution.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Link href="/driver/modules" className="flex-1 min-w-[10rem]">
            <Button variant="outline" className="h-11 w-full rounded-full">
              Back to Modules
            </Button>
          </Link>
          <Link href="/driver/tricycle" className="flex-1 min-w-[10rem]">
            <Button className="h-11 w-full rounded-full">
              <CarFront className="mr-2 h-4 w-4" />
              Open Tricycle
            </Button>
          </Link>
        </div>
      </section>
    </DriverAppShell>
  );
}
