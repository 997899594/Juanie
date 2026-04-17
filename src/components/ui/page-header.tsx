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

export function PageHeader({
  title,
  description,
  actions,
  className,
  eyebrow,
  meta,
}: PageHeaderProps) {
  return (
    <header
      className={cn(
        'flex flex-col gap-4 pb-1 md:flex-row md:items-start md:justify-between',
        className
      )}
    >
      <div className="min-w-0 space-y-2">
        {eyebrow ? (
          <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
            {eyebrow}
          </div>
        ) : null}
        <h1 className="text-2xl font-semibold tracking-tight text-balance md:text-[2rem]">
          {title}
        </h1>
        {description ? (
          <p className="max-w-2xl text-sm leading-6 text-muted-foreground">{description}</p>
        ) : null}
        {meta ? <div className="text-xs text-muted-foreground">{meta}</div> : null}
      </div>
      {actions && (
        <div className="flex w-full flex-wrap items-center gap-2 pt-1 md:w-auto md:justify-end md:pt-0">
          {actions}
        </div>
      )}
    </header>
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
    <Button onClick={onClick} variant={variant} className="h-10 rounded-full px-4" asChild={!!href}>
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
