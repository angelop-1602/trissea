'use client';

import Link from 'next/link';
import { ArrowRight, CheckCircle2 } from 'lucide-react';
import { MobileAuthShell } from '@/components/auth/mobile-auth-shell';
import { Button } from '@/components/ui/button';

export default function PassengerSignupCompletePage() {
  return (
    <MobileAuthShell
      roleTag="Passenger Access"
      title="Account ready"
      subtitle="Your mobile number is verified. You can head straight into the passenger app now."
      mode="signup"
      tone="passenger"
      backHref="/passenger"
      loginHref="/passenger/login"
      signupHref="/passenger/signup"
      helper={
        <p>
          You can update your profile details, emergency contact, and theme mode later from
          Account.
        </p>
      }
    >
      <div className="rounded-[1.6rem] border border-primary/15 bg-primary/[0.06] px-4 py-4">
        <div className="flex items-start gap-3">
          <div className="rounded-full bg-primary/12 p-2 text-primary">
            <CheckCircle2 className="h-5 w-5" />
          </div>
          <div className="space-y-1">
            <p className="text-sm font-semibold text-foreground">Account confirmed</p>
            <p className="text-sm text-muted-foreground">
              Your passenger identity is ready for booking, TODA reservations, and activity
              tracking.
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-3">
        <Button asChild className="h-11 w-full rounded-full">
          <Link href="/passenger/tricycle" className="inline-flex items-center justify-center gap-2">
            Continue to Home
            <ArrowRight className="h-4 w-4" />
          </Link>
        </Button>
        <Button asChild variant="outline" className="h-11 w-full rounded-full">
          <Link href="/passenger/login">Back to Sign In</Link>
        </Button>
      </div>
    </MobileAuthShell>
  );
}
