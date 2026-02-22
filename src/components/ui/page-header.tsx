import { cn } from '@/lib/utils';
import { Button } from './button';

interface PageHeaderProps {
  title: string;
  description?: string;
  actions?: React.ReactNode;
  className?: string;
}

export function PageHeader({ title, description, actions, className }: PageHeaderProps) {
  return (
    <div className={cn('flex flex-col gap-1 pb-4', className)}>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
          {description && <p className="text-muted-foreground">{description}</p>}
        </div>
        {actions && <div className="flex items-center gap-2">{actions}</div>}
      </div>
    </div>
  );
}

interface PageHeaderActionProps {
  label: string;
  onClick?: () => void;
  href?: string;
  icon?: React.ReactNode;
  variant?: 'default' | 'outline' | 'ghost' | 'destructive';
}

export function PageHeaderAction({
  label,
  onClick,
  href,
  icon,
  variant = 'default',
}: PageHeaderActionProps) {
  return (
    <Button onClick={onClick} variant={variant} asChild={!!href}>
      {href ? (
        <a href={href}>
          {icon}
          {label}
        </a>
      ) : (
        <>
          {icon}
          {label}
        </>
      )}
    </Button>
  );
}
