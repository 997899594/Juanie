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
        'flex min-h-48 flex-col items-center justify-center rounded-[20px] border border-dashed border-border bg-secondary/20 p-8 text-center animate-in fade-in-50',
        className
      )}
    >
      {icon && (
        <div className="mb-4 rounded-2xl bg-secondary p-3 text-muted-foreground">{icon}</div>
      )}
      <h3 className="mb-1 text-lg font-semibold">{title}</h3>
      {description && <p className="mb-4 max-w-sm text-sm text-muted-foreground">{description}</p>}
      {action && (
        <Button onClick={action.onClick} asChild={!!action.href} className="rounded-xl px-4">
          {action.href ? <a href={action.href}>{action.label}</a> : action.label}
        </Button>
      )}
    </div>
  );
}
