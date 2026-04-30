import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { BRAND_NAME } from '@/lib/brand';

export default function OfflinePage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-b from-primary/5 to-background px-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>You are offline</CardTitle>
          <CardDescription>
            {BRAND_NAME} cannot reach the network right now. Reconnect and retry your action.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Link href="/passenger/tricycle" className="block">
            <Button className="w-full">Go to Passenger Home</Button>
          </Link>
          <Link href="/" className="block">
            <Button variant="outline" className="w-full">
              Back to Role Entry
            </Button>
          </Link>
        </CardContent>
      </Card>
    </main>
  );
}
