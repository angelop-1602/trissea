import { redirect } from 'next/navigation';

export default function DriverEarningsPage() {
  redirect('/driver/activity?tab=earnings');
}
