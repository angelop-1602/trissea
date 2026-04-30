'use client';

import { useCallback } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { ChevronLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface ReturnNavigationProps {
  fallbackHref?: string;
  ariaLabel?: string;
  className?: string;
  iconClassName?: string;
  label?: string;
  showLabel?: boolean;
  hiddenPaths?: string[];
}

function normalizePath(path: string) {
  const [pathname] = path.split(/[?#]/, 1);

  return pathname.length > 1 && pathname.endsWith('/') ? pathname.slice(0, -1) : pathname;
}

export function ReturnNavigation({
  fallbackHref = '/',
  ariaLabel = 'Go back',
  className,
  iconClassName,
  label = 'Back',
  showLabel = false,
  hiddenPaths,
}: ReturnNavigationProps) {
  const router = useRouter();
  const pathname = usePathname();
  const normalizedCurrentPath = normalizePath(pathname);
  const normalizedFallbackPath = normalizePath(fallbackHref);
  const resolvedHiddenPaths = (hiddenPaths ?? [fallbackHref]).map(normalizePath);

  const handleReturn = useCallback(() => {
    if (typeof window !== 'undefined' && window.history.length > 1) {
      router.back();
      return;
    }

    const safeFallbackHref =
      normalizedFallbackPath === normalizedCurrentPath ? '/' : fallbackHref;

    router.push(safeFallbackHref);
  }, [fallbackHref, normalizedCurrentPath, normalizedFallbackPath, router]);

  if (resolvedHiddenPaths.includes(normalizedCurrentPath)) {
    return null;
  }

  return (
    <Button
      type="button"
      variant="ghost"
      size={showLabel ? 'sm' : 'icon'}
      className={className}
      onClick={handleReturn}
      aria-label={ariaLabel}
    >
      <ChevronLeft className={cn('h-4 w-4', iconClassName)} />
      {showLabel ? <span>{label}</span> : null}
    </Button>
  );
}
