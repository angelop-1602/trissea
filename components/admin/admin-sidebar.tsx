'use client';

import Link from 'next/link';
import { LogOut } from 'lucide-react';
import type { AdminSidebarItem } from '@/lib/admin-navigation';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface AdminSidebarProps {
  items: AdminSidebarItem[];
  activeHref: string;
  collapsed: boolean;
  dashboardHref: string;
  workspaceTitle: string;
  scopeLabel: string;
  displayName: string;
  logo?: string;
  onLogout: () => void | Promise<void>;
}

export function AdminSidebar({
  items,
  activeHref,
  collapsed,
  dashboardHref,
  workspaceTitle,
  scopeLabel,
  displayName,
  logo,
  onLogout,
}: AdminSidebarProps) {
  const isItemActive = (item: AdminSidebarItem): boolean =>
    item.href === activeHref || Boolean(item.items?.some((child) => isItemActive(child)));

  const renderSidebarBadge = (badge?: string | number, isActive?: boolean) => {
    if (badge == null) {
      return null;
    }

    return (
      <span
        className={cn(
          'ml-auto inline-flex min-w-5 items-center justify-center rounded-md px-1.5 py-0.5 text-[11px] font-semibold tabular-nums',
          isActive ? 'bg-primary/18 text-primary' : 'bg-background/34 text-muted-foreground dark:bg-white/8'
        )}
      >
        {badge}
      </span>
    );
  };

  return (
    <aside
      className={cn(
        'relative flex h-full shrink-0 flex-col overflow-hidden border-r border-sidebar-border/80 text-sidebar-foreground transition-all duration-200',
        collapsed ? 'w-22' : 'w-78'
      )}
    >
      <div className="absolute inset-0 bg-[linear-gradient(180deg,color-mix(in_oklab,var(--primary),white_88%)_0%,color-mix(in_oklab,var(--background),white_10%)_34%,color-mix(in_oklab,var(--background),white_2%)_100%)] dark:bg-[linear-gradient(180deg,color-mix(in_oklab,var(--primary),black_84%)_0%,color-mix(in_oklab,var(--background),black_14%)_36%,color-mix(in_oklab,var(--background),black_4%)_100%)]" />
      <div className="absolute inset-0 opacity-20 [background-image:radial-gradient(circle_at_center,color-mix(in_oklab,var(--primary),black_4%)_1px,transparent_1px)] [background-size:14px_14px] dark:opacity-20 dark:[background-image:radial-gradient(circle_at_center,color-mix(in_oklab,var(--primary),white_18%)_1px,transparent_1px)]" />
      <div className="absolute -left-12 top-10 h-36 w-36 rounded-full bg-primary/16 blur-3xl dark:bg-primary/22" />

      <div className="relative flex h-full min-h-0 flex-col">
        <div className="px-4 pb-4 pt-5">
          <Link
            href={dashboardHref}
            title={collapsed ? displayName : undefined}
            className={cn('flex items-center', collapsed ? 'justify-center' : 'gap-3')}
          >
            {logo ? (
              <img
                src={logo}
                alt="Workspace logo"
                className={cn(
                  'rounded-2xl border border-white/12 object-cover shadow-lg',
                  collapsed ? 'h-11 w-11' : 'h-12 w-12'
                )}
              />
            ) : (
              <div
                className={cn(
                  'flex items-center justify-center rounded-2xl border border-white/12 bg-primary font-bold text-primary-foreground shadow-lg',
                  collapsed ? 'h-11 w-11 text-base' : 'h-12 w-12 text-lg'
                )}
              >
                M
              </div>
            )}

            <div className={cn('min-w-0', collapsed && 'sr-only')}>
              <p className="truncate text-sm font-semibold text-foreground dark:text-white">{displayName}</p>
              <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground dark:text-white/55">{workspaceTitle}</p>
            </div>
          </Link>

        </div>

        <nav className="relative flex-1 space-y-1.5 overflow-y-auto px-3 pb-4">
          {items.map((item) => {
            const isActive = isItemActive(item);

            return (
              <div key={item.href ?? item.label} className="space-y-1.5">
                {item.href ? (
                  <Link
                    href={item.href}
                    title={collapsed ? item.label : undefined}
                    className={cn(
                      'group flex items-center rounded-2xl border px-3 py-2.5 text-sm transition-all',
                      collapsed ? 'justify-center' : 'gap-3',
                      isActive
                        ? 'border-primary/30 bg-primary/16 text-foreground shadow-[0_0_0_1px_rgba(255,255,255,0.03),0_10px_30px_-18px_color-mix(in_oklab,var(--primary),black_35%)] dark:text-white'
                        : 'border-transparent text-foreground/72 hover:border-border/70 hover:bg-background/34 hover:text-foreground dark:text-white/72 dark:hover:border-white/10 dark:hover:bg-white/6 dark:hover:text-white'
                    )}
                  >
                    <span className={cn('shrink-0 text-muted-foreground transition-colors', isActive && 'text-primary dark:text-primary')}>
                      {item.icon}
                    </span>
                    <span className={cn('truncate', collapsed && 'sr-only')}>{item.label}</span>
                    {!collapsed ? renderSidebarBadge(item.badge, isActive) : null}
                  </Link>
                ) : (
                  <div
                    className={cn(
                      'flex items-center rounded-2xl px-3 py-2.5 text-sm font-medium text-white/90',
                      'dark:text-white/90',
                      collapsed ? 'justify-center' : 'gap-3'
                    )}
                  >
                    <span className="text-muted-foreground dark:text-white/55">{item.icon}</span>
                    <span className={cn(collapsed && 'sr-only')}>{item.label}</span>
                  </div>
                )}

                {item.items?.length && !collapsed ? (
                  <div className="ml-4 space-y-1 border-l border-border/70 pl-3 dark:border-white/10">
                    {item.items.map((child) => {
                      const isChildActive = isItemActive(child);

                      return child.href ? (
                        <Link
                          key={child.href}
                          href={child.href}
                          className={cn(
                            'group flex items-center gap-3 rounded-xl px-3 py-2 text-sm transition-colors',
                            isChildActive
                              ? 'bg-primary/12 font-semibold text-foreground dark:text-white'
                              : 'text-muted-foreground hover:bg-background/34 hover:text-foreground dark:text-white/55 dark:hover:bg-white/6 dark:hover:text-white'
                          )}
                        >
                          <span className={cn('transition-colors', isChildActive && 'text-primary')}>{child.icon}</span>
                          <span>{child.label}</span>
                          {renderSidebarBadge(child.badge, isChildActive)}
                        </Link>
                      ) : null;
                    })}
                  </div>
                ) : null}
              </div>
            );
          })}
        </nav>

        <div className="relative border-t border-border/70 p-3 dark:border-white/8">
          <Button
            variant="ghost"
            className={cn(
              'w-full rounded-2xl border border-border/70 bg-background/28 text-foreground hover:bg-background/40 hover:text-foreground dark:border-white/10 dark:bg-white/6 dark:text-white dark:hover:bg-white/10 dark:hover:text-white',
              collapsed ? 'px-0 justify-center' : 'justify-start gap-2'
            )}
            onClick={() => void onLogout()}
          >
            <LogOut className="h-4 w-4" />
            <span className={cn(collapsed && 'sr-only')}>Sign out</span>
          </Button>
        </div>
      </div>
    </aside>
  );
}
