import { cn } from '@/lib/utils';
import { Button } from './button';

interface PageHeaderProps {
  title: string;
  description?: string;
  actions?: React.ReactNode;
  className?: string;
  eyebrow?: string;
  meta?: React.ReactNode;
}

export function PageHeader({ title, description, actions, className }: PageHeaderProps) {
  return (
    <div className={cn('pb-1', className)}>
      <div className="flex flex-col gap-2 px-1 py-1 md:gap-3">
        <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
          <div className="min-w-0">
            <h1 className="text-2xl font-semibold tracking-tight text-balance md:text-3xl">
              {title}
            </h1>
            {description ? (
              <p className="mt-1 max-w-3xl text-sm text-muted-foreground">{description}</p>
            ) : null}
          </div>
          {actions && (
            <div className="flex w-full flex-wrap items-center gap-2 md:w-auto md:justify-end">
              {actions}
            </div>
          )}
        </div>
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
