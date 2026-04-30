import type { ComponentProps } from 'react';
import type { LucideIcon } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

type InputProps = ComponentProps<typeof Input>;

interface AuthInputProps extends InputProps {
  icon: LucideIcon;
}

export function AuthInput({ icon: Icon, className, ...props }: AuthInputProps) {
  return (
    <div className="relative">
      <Icon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        className={cn(
          'h-12 rounded-2xl border-border/50 bg-background/60 pl-9 text-sm text-foreground placeholder:text-muted-foreground',
          className
        )}
        {...props}
      />
    </div>
  );
}
