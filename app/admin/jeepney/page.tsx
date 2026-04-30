'use client';

import Link from 'next/link';
import { BusFront, CarFront } from 'lucide-react';
import { AppHeader } from '@/components/app-header';
import { PageHeader } from '@/components/admin/page-header';
import { TableSurface } from '@/components/admin/table-surface';
import { SidebarLayout } from '@/components/sidebar-layout';
import { Button } from '@/components/ui/button';
import { getAdminSidebarItems } from '@/lib/admin-navigation';

export default function AdminJeepneyPage() {
  return (
    <>
      <AppHeader />
      <div className="mx-auto max-w-7xl px-4 pb-8">
        <SidebarLayout title="Admin Menu" items={getAdminSidebarItems()}>
          <div className="space-y-6">
            <PageHeader
              eyebrow="Jeepney Module"
              title="Jeepney workspace is not live yet"
              description="The admin platform now reserves a separate workspace for jeepney instead of forcing it into tricycle dashboards, but the real jeepney operations tooling still needs to be implemented."
            />

            <TableSurface title="Current state" description="What is ready in this phase.">
              <div className="flex items-start gap-3 text-sm text-muted-foreground">
                <span className="rounded-full border border-primary/20 bg-primary/10 p-2 text-primary">
                  <BusFront className="h-4 w-4" />
                </span>
                <p>
                  Module-aware admin routing is now in place, so future jeepney CRUD can live under its own route space for stops, routes, vehicles, departures, and manifests.
                </p>
              </div>
            </TableSurface>

            <TableSurface title="Next phase" description="What still needs to be added for jeepney admin.">
              <div className="space-y-3 text-sm text-muted-foreground">
                <p>Route and stop management.</p>
                <p>Vehicle and capacity management.</p>
                <p>Departure scheduling and publishing.</p>
                <p>Manifest and booking oversight for published departures.</p>
              </div>
            </TableSurface>

            <div className="flex flex-wrap gap-2">
              <Button asChild variant="outline">
                <Link href="/admin/modules">Back to Modules</Link>
              </Button>
              <Button asChild>
                <Link href="/admin/tricycle">
                  <CarFront className="mr-2 h-4 w-4" />
                  Open Tricycle
                </Link>
              </Button>
            </div>
          </div>
        </SidebarLayout>
      </div>
    </>
  );
}
