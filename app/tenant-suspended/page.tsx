import Link from 'next/link';
import { AlertTriangle } from 'lucide-react';
import { MobileAuthShell } from '@/components/auth/mobile-auth-shell';

function resolveReturnHref(role?: string) {
  if (role === 'admin' || role === 'superadmin') {
    return '/admin-login';
  }

  if (role === 'driver') {
    return '/driver/login';
  }

  return '/passenger/login';
}

export default async function TenantSuspendedPage({
  searchParams,
}: {
  searchParams: Promise<{ role?: string; message?: string }>;
}) {
  const params = await searchParams;
  const role = typeof params.role === 'string' ? params.role : undefined;
  const message =
    typeof params.message === 'string' && params.message.trim().length > 0
      ? params.message
      : 'This tenant workspace is currently suspended. Please contact platform support for assistance.';
  const returnHref = resolveReturnHref(role);

  return (
    <MobileAuthShell
      roleTag="Workspace Status"
      title="Tenant Suspended"
      subtitle="Access is temporarily blocked while platform support reviews this tenant workspace."
      mode="login"
      tone="status"
      backHref="/"
      loginHref={returnHref}
      signupHref={returnHref}
      loginLabel="Back to Sign In"
      signupLabel="Back to Sign In"
      showModeSwitch={false}
      helper={
        <div className="space-y-2 text-center">
          <p>Only platform super admins can access tenant controls while a suspension is active.</p>
          <p>
            Need a different account? <Link href="/" className="font-semibold text-foreground hover:text-primary">Return to role entry</Link>
          </p>
        </div>
      }
    >
      <div className="space-y-4 rounded-[1.5rem] border border-amber-400/35 bg-amber-500/10 p-4 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-amber-500/15 text-amber-700 dark:text-amber-300">
          <AlertTriangle className="h-6 w-6" />
        </div>
        <p className="text-sm text-foreground">{message}</p>
        <Link
          href={returnHref}
          className="inline-flex h-11 w-full items-center justify-center rounded-full bg-primary px-4 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
        >
          Back to Sign In
        </Link>
      </div>
    </MobileAuthShell>
  );
}
