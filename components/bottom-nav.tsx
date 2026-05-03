"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

interface BottomNavItem {
  href: string;
  icon: ReactNode;
  label: string;
  matchPaths?: string[];
  isPrimaryAction?: boolean;
}

interface BottomNavProps {
  items: BottomNavItem[];
}

export function BottomNav({ items }: BottomNavProps) {
  const pathname = usePathname();

  return (
    <nav
      className="pointer-events-none fixed inset-x-0 bottom-0 z-50 md:hidden"
      aria-label="Passenger primary navigation"
    >
      <div className="pointer-events-auto relative w-full overflow-visible border-t border-border/60 bg-background/95 px-2 pt-1 pb-[calc(env(safe-area-inset-bottom)+1.35rem)] shadow-[0_-12px_30px_-24px_rgba(15,31,22,0.45)] backdrop-blur-2xl supports-[backdrop-filter]:bg-background/88">
        <div
          className="grid h-[3.6rem] items-end gap-0.5"
          style={{
            gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))`,
          }}
        >
          {items.map((item) => {
            const activePaths = item.matchPaths?.length
              ? item.matchPaths
              : [item.href];

            const isActive = activePaths.some(
              (path) => pathname === path || pathname.startsWith(`${path}/`),
            );

            const isPrimaryAction = Boolean(item.isPrimaryAction);

            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={isActive ? "page" : undefined}
                className={cn(
                  "relative flex min-w-0 flex-col items-center rounded-[0.95rem] px-1 text-[10px] transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                  isPrimaryAction
                    ? "justify-end pb-2.5 pt-7"
                    : "justify-center gap-1 pb-2.5 pt-1",
                  isActive
                    ? "text-primary"
                    : "text-muted-foreground hover:text-foreground",
                  !isPrimaryAction && "hover:bg-muted/35",
                )}
              >
                <span
                  className={cn(
                    "flex shrink-0 items-center justify-center transition-all duration-200",
                    isPrimaryAction
                      ? "absolute left-1/2 top-0 h-[52px] w-[52px] -translate-x-1/2 -translate-y-[58%] rotate-45 rounded-[1rem] bg-primary text-primary-foreground shadow-[0_18px_32px_-15px_rgba(20,98,46,0.95)] after:absolute after:-bottom-1.5 after:left-1/2 after:h-1.5 after:w-8 after:-translate-x-1/2 after:rounded-full after:bg-accent"
                      : "h-7 w-7 -translate-y-0.5 rounded-full",
                    !isPrimaryAction && isActive
                      ? "bg-primary/10 text-primary"
                      : null,
                    isPrimaryAction && isActive
                      ? "ring-4 ring-primary/15"
                      : null,
                  )}
                >
                  <span
                    className={cn(
                      "flex items-center justify-center",
                      isPrimaryAction ? "-rotate-45" : null,
                    )}
                  >
                    {item.icon}
                  </span>
                </span>

                <span
                  className={cn(
                    "truncate leading-none",
                    isPrimaryAction ? "mt-3.5" : null,
                    isActive
                      ? "font-bold text-primary"
                      : "font-medium text-muted-foreground",
                  )}
                >
                  {item.label}
                </span>

                {isActive ? (
                  <span className="mt-1 h-1.5 w-1.5 rounded-full bg-primary" />
                ) : null}
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}