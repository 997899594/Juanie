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
    <div className={cn('pb-2', className)}>
      <div className="console-panel overflow-hidden">
        <div className="flex flex-col gap-5 px-4 py-4 md:px-5 md:py-5">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div className="min-w-0">
              {eyebrow ? <div className="console-eyebrow">{eyebrow}</div> : null}
              <h1 className="mt-3 text-2xl font-semibold tracking-tight text-balance md:text-4xl">
                {title}
              </h1>
              {description ? (
                <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground md:text-[15px]">
                  {description}
                </p>
              ) : null}
            </div>
            {actions && (
              <div className="flex w-full flex-wrap items-center gap-2 md:w-auto md:justify-end">
                {actions}
              </div>
            )}
          </div>
          {meta ? (
            <div className="rounded-[18px] border border-border/70 bg-background/35 px-4 py-2.5 text-sm text-muted-foreground">
              {meta}
            </div>
          ) : null}
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
