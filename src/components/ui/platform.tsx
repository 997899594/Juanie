import { ArrowRight } from 'lucide-react';
import Link from 'next/link';
import type { ElementType, ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { PagePanel, type PagePanelProps } from './page-shell';

interface SectionLabelProps {
  children: ReactNode;
  as?: ElementType;
  className?: string;
}

export function SectionLabel({ children, as: Component = 'div', className }: SectionLabelProps) {
  return (
    <Component
      className={cn(
        'text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground',
        className
      )}
    >
      {children}
    </Component>
  );
}

interface MetricTileProps {
  label: ReactNode;
  value: ReactNode;
  description?: ReactNode;
  icon?: ReactNode;
  className?: string;
  panel?: PagePanelProps['variant'];
  size?: 'sm' | 'lg';
}

export function MetricTile({
  label,
  value,
  description,
  icon,
  className,
  panel = 'panel',
  size = 'sm',
}: MetricTileProps) {
  return (
    <PagePanel
      variant={panel}
      padding="sm"
      className={cn(
        'flex items-start justify-between gap-3',
        size === 'lg' && 'px-5 py-4',
        className
      )}
    >
      <div className="min-w-0">
        <SectionLabel>{label}</SectionLabel>
        <div
          className={cn(
            'mt-2 font-semibold tracking-tight text-foreground',
            size === 'lg' ? 'text-3xl' : 'text-sm'
          )}
        >
          {value}
        </div>
        {description ? (
          <div className="mt-1 text-xs text-muted-foreground">{description}</div>
        ) : null}
      </div>
      {icon ? (
        <div className="ui-control-muted flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl text-muted-foreground">
          {icon}
        </div>
      ) : null}
    </PagePanel>
  );
}

interface ActionTileProps {
  title: ReactNode;
  description?: ReactNode;
  eyebrow?: ReactNode;
  meta?: ReactNode;
  accessory?: ReactNode;
  icon?: ReactNode;
  iconFrame?: boolean;
  href?: string;
  onClick?: () => void;
  className?: string;
  tone?: 'neutral' | 'primary' | 'danger';
  density?: 'normal' | 'compact';
  showArrow?: boolean;
}

const actionTileToneClassName: Record<NonNullable<ActionTileProps['tone']>, string> = {
  neutral: 'text-muted-foreground',
  primary: 'bg-primary text-primary-foreground shadow-[0_10px_24px_rgba(55,53,47,0.14)]',
  danger: 'bg-destructive text-destructive-foreground shadow-[0_10px_24px_rgba(196,85,77,0.14)]',
};

function ActionTileContent({
  title,
  description,
  eyebrow,
  meta,
  accessory,
  icon,
  iconFrame = true,
  tone = 'neutral',
  density = 'normal',
  showArrow,
}: Omit<ActionTileProps, 'href' | 'onClick' | 'className'>) {
  const hasVisual = Boolean(icon || showArrow);

  return (
    <>
      {icon ? (
        iconFrame ? (
          <div
            className={cn(
              'flex shrink-0 items-center justify-center rounded-[18px]',
              density === 'compact' ? 'h-10 w-10' : 'h-11 w-11',
              tone === 'neutral'
                ? 'bg-secondary/80 text-muted-foreground'
                : actionTileToneClassName[tone]
            )}
          >
            {icon}
          </div>
        ) : (
          icon
        )
      ) : null}
      <div className="min-w-0 flex-1">
        {eyebrow ? <SectionLabel className="mb-1">{eyebrow}</SectionLabel> : null}
        <div className="truncate text-sm font-semibold text-foreground">{title}</div>
        {description ? (
          <div className="mt-1 text-xs leading-5 text-muted-foreground">{description}</div>
        ) : null}
        {meta ? <div className="mt-2 text-xs text-muted-foreground">{meta}</div> : null}
      </div>
      {hasVisual && showArrow ? (
        <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-foreground" />
      ) : null}
      {accessory ? <div className="shrink-0">{accessory}</div> : null}
    </>
  );
}

export function ActionTile({
  title,
  description,
  eyebrow,
  meta,
  accessory,
  icon,
  iconFrame,
  href,
  onClick,
  className,
  tone = 'neutral',
  density = 'normal',
  showArrow = Boolean(href),
}: ActionTileProps) {
  const content = (
    <ActionTileContent
      title={title}
      description={description}
      eyebrow={eyebrow}
      meta={meta}
      accessory={accessory}
      icon={icon}
      iconFrame={iconFrame}
      tone={tone}
      density={density}
      showArrow={showArrow}
    />
  );
  const classNames = cn(
    'group console-panel flex w-full items-start gap-4 text-left transition-[background-color,transform,box-shadow] hover:-translate-y-px hover:bg-white/90 focus-visible:ring-2 focus-visible:ring-ring/15',
    density === 'compact' ? 'min-h-16 px-4 py-3' : 'px-5 py-4',
    className
  );

  if (href) {
    return (
      <Link href={href} className={classNames}>
        {content}
      </Link>
    );
  }

  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={classNames}>
        {content}
      </button>
    );
  }

  return <div className={classNames}>{content}</div>;
}
