'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';

interface BottomNavItem {
  href: string;
  icon: React.ReactNode;
  label: string;
  matchPaths?: string[];
}

interface BottomNavProps {
  items: BottomNavItem[];
}

export function BottomNav({ items }: BottomNavProps) {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 px-3 pb-[max(env(safe-area-inset-bottom),0.6rem)] md:hidden">
      <div className="mx-auto w-full max-w-screen-sm">
        <div className="rounded-[2rem] border border-border/60 bg-background/88 p-2 shadow-[0_20px_45px_-18px_rgba(0,0,0,0.45)] backdrop-blur-2xl supports-[backdrop-filter]:bg-background/74">
          <div className="grid grid-cols-4 gap-1.5">
            {items.map((item) => {
              const activePaths = item.matchPaths?.length ? item.matchPaths : [item.href];
              const isActive = activePaths.some(
                (path) => pathname === path || pathname.startsWith(`${path}/`)
              );
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    'relative flex min-h-[4.1rem] flex-col items-center justify-center gap-1 rounded-[1.35rem] px-2 py-2 text-[11px] font-medium transition-all duration-200',
                    isActive
                      ? 'bg-primary/12 text-primary shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]'
                      : 'text-muted-foreground hover:bg-muted/35 hover:text-foreground'
                  )}
                  aria-current={isActive ? 'page' : undefined}
                >
                  <span
                    className={cn(
                      'flex h-5 items-center justify-center transition-transform',
                      isActive ? 'scale-105' : 'scale-100'
                    )}
                  >
                    {item.icon}
                  </span>
                  <span className={cn('leading-none', isActive ? 'font-semibold' : 'font-medium')}>
                    {item.label}
                  </span>
                </Link>
              );
            })}
          </div>
        </div>
      </div>
    </nav>
  );
}
