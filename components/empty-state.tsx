import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import React from 'react';

interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
}

export function EmptyState({
  icon,
  title,
  description,
  actionLabel,
  onAction,
}: EmptyStateProps) {
  return (
    <Card className="border-dashed">
      <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
        {icon && <div className="mb-4 text-muted-foreground scale-150">{icon}</div>}
        <h3 className="font-semibold text-lg mb-2">{title}</h3>
        {description && <p className="text-sm text-muted-foreground mb-6">{description}</p>}
        {actionLabel && onAction && (
          <Button onClick={onAction}>{actionLabel}</Button>
        )}
      </div>
    </Card>
  );
}
