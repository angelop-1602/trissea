'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function DriverOnboardingPage() {
  return (
    <main className="theme-driver flex min-h-screen items-center justify-center bg-gradient-to-b from-primary/5 to-background px-4 py-10">
      <Card className="w-full max-w-xl">
        <CardHeader>
          <CardTitle>Driver Onboarding</CardTitle>
          <CardDescription>
            Your driver account is created. Continue profile and document completion before
            activation.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Required onboarding sections include identity details, license data, and vehicle data.
          </p>
          <div className="grid gap-2 sm:grid-cols-2">
            <Button asChild>
              <Link href="/driver/status">View Driver Status</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/driver/login">Driver Sign In</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </main>
  );
}
