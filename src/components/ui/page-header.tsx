import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { forwardRef, type ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { Button, type ButtonProps } from './button';

interface PageHeaderProps {
  title: string;
  description?: string;
  actions?: ReactNode;
  className?: string;
  eyebrow?: string;
  meta?: ReactNode;
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

interface PageHeaderActionProps
  extends Omit<ButtonProps, 'asChild' | 'children' | 'size' | 'variant'> {
  label: string;
  href?: string;
  icon?: ReactNode;
  variant?: 'default' | 'outline' | 'ghost' | 'secondary' | 'destructive';
  size?: 'sm' | 'default';
}

export const PageHeaderAction = forwardRef<HTMLButtonElement, PageHeaderActionProps>(
  ({ label, href, icon, variant = 'default', size = 'default', className, ...props }, ref) => (
    <Button
      ref={ref}
      variant={variant}
      size={size}
      className={cn('rounded-full', size === 'sm' ? 'h-9 px-4 text-sm' : 'h-10 px-4', className)}
      asChild={!!href}
      {...props}
    >
      {href ? (
        <Link href={href}>
          {icon}
          {label}
        </Link>
      ) : (
        <>
          {icon}
          {label}
        </>
      )}
    </Button>
  )
);
PageHeaderAction.displayName = 'PageHeaderAction';

export function PageBackAction({
  label = '返回',
  href,
  size = 'default',
  className,
  ...props
}: Omit<PageHeaderActionProps, 'label' | 'icon' | 'variant'> & {
  label?: string;
}) {
  return (
    <PageHeaderAction
      label={label}
      href={href}
      icon={<ArrowLeft className="h-4 w-4" />}
      variant="ghost"
      size={size}
      className={className}
      {...props}
    />
  );
}
