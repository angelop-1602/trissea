import { cn } from '@/lib/utils';

type StatusType =
  | 'searching'
  | 'matched'
  | 'en-route'
  | 'en_route'
  | 'arrived'
  | 'in-trip'
  | 'in_trip'
  | 'completed'
  | 'cancelled'
  | 'pending'
  | 'confirmed';

const statusConfig: Record<StatusType, { label: string; className: string }> = {
  searching: { label: 'Searching', className: 'status-searching' },
  matched: { label: 'Matched', className: 'status-matched' },
  'en-route': { label: 'En Route', className: 'status-en-route' },
  en_route: { label: 'En Route', className: 'status-en-route' },
  arrived: { label: 'Arrived', className: 'status-in-trip' },
  'in-trip': { label: 'In Trip', className: 'status-in-trip' },
  in_trip: { label: 'In Trip', className: 'status-in-trip' },
  completed: { label: 'Completed', className: 'status-completed' },
  cancelled: { label: 'Cancelled', className: 'status-cancelled' },
  pending: { label: 'Pending', className: 'status-pending' },
  confirmed: { label: 'Confirmed', className: 'status-confirmed' },
};

function formatFallbackStatusLabel(status: string) {
  return status
    .replaceAll('_', ' ')
    .replaceAll('-', ' ')
    .split(' ')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

interface StatusBadgeProps {
  status: StatusType | string;
  className?: string;
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const config = statusConfig[status as StatusType] ?? {
    label: formatFallbackStatusLabel(status),
    className: 'status-pending',
  };
  
  return (
    <span className={cn(
      'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold',
      config.className,
      className
    )}>
      {config.label}
    </span>
  );
}
