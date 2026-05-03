'use client';

import Link from 'next/link';
import { ArrowRight, BusFront, CarFront, Layers3 } from 'lucide-react';
import { AppHeader } from '@/components/app-header';
import { PageHeader } from '@/components/admin/page-header';
import { TableSurface } from '@/components/admin/table-surface';
import { SidebarLayout } from '@/components/sidebar-layout';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { getAdminSidebarItems } from '@/lib/admin-navigation';
import { useStore } from '@/lib/store-context';
import {
  getEnabledTransportModules,
  getModuleLandingRouteForRole,
  type TenantTransportModuleSummary,
} from '@/lib/transport-modules';

function getModuleIcon(moduleKey: TenantTransportModuleSummary['moduleKey']) {
  return moduleKey === 'jeepney' || moduleKey === 'bus' ? (
    <BusFront className="h-4 w-4" />
  ) : (
    <CarFront className="h-4 w-4" />
  );
}

export default function AdminModulesPage() {
  const { currentTenant, currentTenantModules } = useStore();
  const enabledModules = getEnabledTransportModules(currentTenantModules);
  const disabledModules = currentTenantModules.filter((module) => !module.isEnabled);

  return (
    <>
      <AppHeader />
      <div className="mx-auto max-w-7xl px-4 pb-8">
        <SidebarLayout title="Admin Menu" items={getAdminSidebarItems()}>
          <div className="space-y-6">
            <PageHeader
              eyebrow="Transport Modules"
              title="Modules"
              description={`Use this workspace entry to separate shared admin behavior from transport-specific modules for ${currentTenant?.name ?? 'this tenant'}.`}
            />

            <TableSurface
              title="Enabled modules"
              description="These transport modules are currently visible in the tenant workspace."
              actions={
                enabledModules[0] ? (
                  <Button asChild variant="outline" size="sm">
                    <Link href={getModuleLandingRouteForRole('admin', enabledModules[0].moduleKey)}>
                      Open default module
                      <ArrowRight className="h-4 w-4" />
                    </Link>
                  </Button>
                ) : null
              }
              bodyClassName="pt-0"
            >
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Module</TableHead>
                    <TableHead>Stage</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Open</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {enabledModules.length > 0 ? (
                    enabledModules.map((module) => (
                      <TableRow key={module.moduleKey}>
                        <TableCell>
                          <div className="flex items-start gap-3">
                            <span className="mt-0.5 rounded-full border border-primary/20 bg-primary/10 p-2 text-primary">
                              {getModuleIcon(module.moduleKey)}
                            </span>
                            <div className="space-y-1">
                              <p className="font-medium">{module.label}</p>
                              <p className="text-xs text-muted-foreground">{module.summary}</p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>{module.stage === 'live' ? 'Live' : 'Preparing'}</TableCell>
                        <TableCell>{module.isDefault ? 'Default module' : 'Enabled'}</TableCell>
                        <TableCell className="text-right">
                          <Button asChild variant="ghost" size="sm">
                            <Link href={getModuleLandingRouteForRole('admin', module.moduleKey)}>
                              {module.stage === 'live' ? 'Open' : 'Preview'}
                            </Link>
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={4} className="py-8 text-center text-sm text-muted-foreground">
                        No transport modules are enabled for this tenant workspace yet.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </TableSurface>

            <TableSurface
              title="Prepared but not enabled"
              description="These modules are recognized by the platform but are not enabled for this tenant yet."
              bodyClassName="pt-0"
            >
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Module</TableHead>
                    <TableHead>Stage</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {disabledModules.length > 0 ? (
                    disabledModules.map((module) => (
                      <TableRow key={module.moduleKey}>
                        <TableCell>
                          <div className="flex items-start gap-3">
                            <span className="mt-0.5 rounded-full border border-border/60 bg-background/70 p-2 text-muted-foreground">
                              {getModuleIcon(module.moduleKey)}
                            </span>
                            <div className="space-y-1">
                              <p className="font-medium">{module.label}</p>
                              <p className="text-xs text-muted-foreground">{module.summary}</p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>{module.stage === 'live' ? 'Live' : 'Preparing'}</TableCell>
                        <TableCell>Not enabled</TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={3} className="py-8 text-center text-sm text-muted-foreground">
                        Every configured module is already visible in this tenant workspace.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </TableSurface>

            <TableSurface
              title="Foundation note"
              description="This phase only prepares the platform boundary."
            >
              <div className="flex items-start gap-3 text-sm text-muted-foreground">
                <span className="rounded-full border border-primary/20 bg-primary/10 p-2 text-primary">
                  <Layers3 className="h-4 w-4" />
                </span>
                <p>
                  Tricycle remains the live admin workspace. Jeepney now has a reserved module entry and route space, but the real route, stop, vehicle, departure, and manifest admin tools still need to be built as the next phase.
                </p>
              </div>
            </TableSurface>
          </div>
        </SidebarLayout>
      </div>
    </>
  );
}
