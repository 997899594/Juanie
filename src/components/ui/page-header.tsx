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
    <div className={cn('pb-4', className)}>
      <div className="flex flex-col gap-4 rounded-[24px] border border-border bg-card px-4 py-4 md:flex-row md:items-center md:justify-between md:px-5">
        <div className="min-w-0">
          <h1 className="text-lg font-semibold tracking-tight text-balance md:text-2xl">{title}</h1>
          {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
        </div>
        {actions && (
          <div className="flex w-full flex-wrap items-center gap-2 md:w-auto md:justify-end">
            {actions}
          </div>
        )}
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
    <Button onClick={onClick} variant={variant} className="rounded-xl px-4" asChild={!!href}>
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
