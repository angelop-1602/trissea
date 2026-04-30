'use client';

import { useEffect } from 'react';
import { Button } from '@/components/ui/button';

interface ErrorPageProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function ErrorPage({ error, reset }: ErrorPageProps) {
  useEffect(() => {
    console.error('Route error boundary caught:', error);
  }, [error]);

  return (
    <main className="flex min-h-[60vh] items-center justify-center px-4">
      <div className="w-full max-w-md space-y-3 rounded-xl border bg-background p-6 text-center">
        <h1 className="text-lg font-semibold">Something went wrong</h1>
        <p className="text-sm text-muted-foreground">
          Please retry. If this keeps happening, share the request ID from the latest error message with support.
        </p>
        <Button onClick={reset} className="w-full">
          Try again
        </Button>
      </div>
    </main>
  );
}
