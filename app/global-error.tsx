'use client';

import { useEffect } from 'react';

interface GlobalErrorPageProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function GlobalErrorPage({ error, reset }: GlobalErrorPageProps) {
  useEffect(() => {
    console.error('Global error boundary caught:', error);
  }, [error]);

  return (
    <html lang="en">
      <body>
        <main className="flex min-h-screen items-center justify-center px-4">
          <div className="w-full max-w-md space-y-3 rounded-xl border bg-background p-6 text-center">
            <h1 className="text-lg font-semibold">Unexpected application error</h1>
            <p className="text-sm text-muted-foreground">
              Refresh the page or retry. If the issue persists, contact support.
            </p>
            <button
              type="button"
              onClick={reset}
              className="inline-flex h-9 w-full items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground"
            >
              Retry
            </button>
          </div>
        </main>
      </body>
    </html>
  );
}
