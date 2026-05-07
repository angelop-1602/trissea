'use client';

import Link from 'next/link';
import { ArrowRight, BusFront, CarFront, Lock, MapPinned, Route } from 'lucide-react';
import { PassengerAppShell } from '@/components/passenger/passenger-app-shell';
import { Button } from '@/components/ui/button';
import { useStore } from '@/lib/store-context';
import {
  getEnabledTransportModules,
  getModuleLandingRouteForRole,
  type TenantTransportModuleSummary,
} from '@/lib/transport-modules';

function getModuleIcon(moduleKey: TenantTransportModuleSummary['moduleKey']) {
  switch (moduleKey) {
    case 'jeepney':
      return <BusFront className="h-5 w-5" />;
    case 'p2p':
      return <Route className="h-5 w-5" />;
    case 'tricycle':
    default:
      return <CarFront className="h-5 w-5" />;
  }
}

function getStageLabel(stage: TenantTransportModuleSummary['stage']) {
  return stage === 'live' ? 'Live' : 'Preparing';
}

function TransportModuleCard({
  module,
}: {
  module: TenantTransportModuleSummary;
}) {
  return (
    <div className="rounded-[1.7rem] border border-border/60 bg-background/60 px-4 py-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="rounded-full border border-primary/20 bg-primary/10 p-2 text-primary">
            {getModuleIcon(module.moduleKey)}
          </div>
          <div className="space-y-1">
            <p className="text-sm font-semibold text-foreground">{module.label}</p>
            <p className="text-sm text-muted-foreground">{module.summary}</p>
          </div>
        </div>
        <span className="inline-flex rounded-full border border-border/70 bg-background/70 px-3 py-1 text-[11px] font-medium text-muted-foreground">
          {getStageLabel(module.stage)}
        </span>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {module.isEnabled ? (
          <Link href={getModuleLandingRouteForRole('passenger', module.moduleKey)} className="flex-1 min-w-[10rem]">
            <Button className="h-11 w-full rounded-full">
              {module.stage === 'live' ? 'Open Module' : 'Preview Module'}
              <ArrowRight className="ml-1 h-4 w-4" />
            </Button>
          </Link>
        ) : (
          <Button variant="outline" className="h-11 min-w-[10rem] rounded-full" disabled>
            <Lock className="mr-2 h-4 w-4" />
            Not Enabled
          </Button>
        )}
      </div>
    </div>
  );
}

export default function PassengerModulesPage() {
  const { currentTenant, currentTenantModules } = useStore();
  const enabledModules = getEnabledTransportModules(currentTenantModules);
  const disabledModules = currentTenantModules.filter((module) => !module.isEnabled);

  return (
    <PassengerAppShell
      title="Modules"
      subtitle="Choose the transport workspace available in your passenger app."
      topContext="Modules"
      headerVariant="compact"
      headerSurface="minimal"
    >
      <section className="rounded-[2rem] border border-primary/15 bg-primary/[0.07] px-4 py-5">
        <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">TRISSEA platform</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">
          {currentTenant?.name ?? 'Passenger modules'}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Open the live tricycle module now, and use this hub as the entry point once more transport modules are enabled.
        </p>
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between gap-3 px-1">
          <h2 className="text-sm font-semibold tracking-tight text-foreground">Available now</h2>
          <span className="text-xs text-muted-foreground">{enabledModules.length} enabled</span>
        </div>
        {enabledModules.length > 0 ? (
          <div className="space-y-3">
            {enabledModules.map((module) => (
              <TransportModuleCard key={module.moduleKey} module={module} />
            ))}
          </div>
        ) : (
          <div className="rounded-[1.7rem] border border-dashed border-border/70 bg-background/60 px-4 py-5 text-sm text-muted-foreground">
            No transport modules are enabled for this passenger workspace yet.
          </div>
        )}
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between gap-3 px-1">
          <h2 className="text-sm font-semibold tracking-tight text-foreground">Not enabled yet</h2>
          <span className="text-xs text-muted-foreground">Foundation only</span>
        </div>
        {disabledModules.length > 0 ? (
          <div className="space-y-3">
            {disabledModules.map((module) => (
              <TransportModuleCard key={module.moduleKey} module={module} />
            ))}
          </div>
        ) : (
          <div className="rounded-[1.7rem] border border-dashed border-border/70 bg-background/60 px-4 py-5 text-sm text-muted-foreground">
            Every configured module is already visible in this workspace.
          </div>
        )}
      </section>

      <section className="rounded-[1.7rem] border border-border/60 bg-background/60 px-4 py-4">
        <div className="flex items-start gap-3">
          <div className="rounded-full border border-primary/20 bg-primary/10 p-2 text-primary">
            <MapPinned className="h-4 w-4" />
          </div>
          <div className="space-y-1">
            <p className="text-sm font-medium text-foreground">Current rollout note</p>
            <p className="text-sm text-muted-foreground">
              Tricycle stays fully live. Jeepney and P2P are visible as prepared module entries until their route, departure, and booking flows are implemented.
            </p>
          </div>
        </div>
      </section>
    </PassengerAppShell>
  );
}
