import { cn } from '@/lib/utils';

type StatusType = 'success' | 'warning' | 'error' | 'info' | 'neutral';

interface StatusIndicatorProps {
  status: StatusType;
  label?: string;
  pulse?: boolean;
  className?: string;
}

const statusColors: Record<StatusType, string> = {
  success: 'bg-success',
  warning: 'bg-warning',
  error: 'bg-destructive',
  info: 'bg-info',
  neutral: 'bg-muted-foreground',
};

export function StatusIndicator({ status, label, pulse, className }: StatusIndicatorProps) {
  return (
    <div className={cn('flex items-center gap-2', className)}>
      <span className="relative flex h-2.5 w-2.5">
        <span
          className={cn(
            'absolute inline-flex h-full w-full rounded-full opacity-75',
            statusColors[status],
            pulse && 'animate-ping'
          )}
        />
        <span
          className={cn('relative inline-flex rounded-full h-2.5 w-2.5', statusColors[status])}
        />
      </span>
      {label && <span className="text-sm font-medium">{label}</span>}
    </div>
  );
}
