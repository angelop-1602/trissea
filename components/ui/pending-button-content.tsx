import type { ReactNode } from 'react';
import { Loader2 } from 'lucide-react';

interface PendingButtonContentProps {
  pending: boolean;
  label: string;
  icon?: ReactNode;
}

export function PendingButtonContent({ pending, label, icon }: PendingButtonContentProps) {
  return (
    <span className="inline-flex items-center gap-2">
      <span className="inline-flex h-4 w-4 items-center justify-center">
        {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : icon}
      </span>
      <span>{label}</span>
    </span>
  );
}
