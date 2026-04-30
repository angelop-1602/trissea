import { redirect } from 'next/navigation';

export default function DriverHistoryPage() {
  redirect('/driver/activity?tab=trips');
}
