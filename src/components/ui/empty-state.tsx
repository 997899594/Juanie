import { cn } from '@/lib/utils';
import { Button } from './button';

interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: {
    label: string;
    onClick?: () => void;
    href?: string;
  };
  className?: string;
}

export function EmptyState({ icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex min-h-48 flex-col items-center justify-center rounded-[22px] bg-[linear-gradient(180deg,rgba(250,248,244,0.9),rgba(255,255,255,0.84))] p-8 text-center shadow-[0_1px_0_rgba(255,255,255,0.82)_inset,0_0_0_1px_rgba(17,17,17,0.035)] animate-in fade-in-50',
        className
      )}
    >
      {icon && (
        <div className="mb-4 rounded-[18px] bg-secondary/82 p-3 text-muted-foreground shadow-[0_1px_0_rgba(255,255,255,0.76)_inset]">
          {icon}
        </div>
      )}
      <h3 className="mb-1 text-lg font-semibold tracking-tight">{title}</h3>
      {description && (
        <p className="mb-4 max-w-sm text-sm leading-6 text-muted-foreground">{description}</p>
      )}
      {action && (
        <Button
          onClick={action.onClick}
          asChild={!!action.href}
          variant="secondary"
          className="rounded-full px-4"
        >
          {action.href ? <a href={action.href}>{action.label}</a> : action.label}
        </Button>
      )}
    </div>
  );
}
