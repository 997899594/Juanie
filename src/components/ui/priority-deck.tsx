import { ArrowRight } from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';

export interface PriorityDeckItem {
  key: string;
  eyebrow: string;
  title: string;
  description?: string;
  href?: string;
  actionLabel?: string;
  tone?: 'default' | 'danger' | 'warning' | 'success';
}

interface PriorityDeckProps {
  title: string;
  description?: string;
  items: PriorityDeckItem[];
  className?: string;
}

const toneClasses: Record<NonNullable<PriorityDeckItem['tone']>, string> = {
  default: 'bg-foreground/80',
  danger: 'bg-destructive',
  warning: 'bg-warning',
  success: 'bg-success',
};

export function PriorityDeck({ title, description, items, className }: PriorityDeckProps) {
  if (items.length === 0) {
    return null;
  }

  return (
    <section className={cn('console-panel overflow-hidden', className)}>
      <div className="border-b border-border px-5 py-4">
        <div className="text-sm font-semibold text-foreground">{title}</div>
        {description ? (
          <div className="mt-1 text-xs text-muted-foreground">{description}</div>
        ) : null}
      </div>
      <div className="grid gap-3 p-3 xl:grid-cols-3">
        {items.map((item, index) => {
          const content = (
            <div
              className={cn(
                'console-surface flex h-full flex-col rounded-[20px] px-4 py-4 transition-colors',
                item.href ? 'hover:bg-secondary/70' : ''
              )}
            >
              <div className="flex items-center gap-2">
                <span
                  className={cn(
                    'inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-[10px] font-semibold',
                    index === 0 ? 'bg-black text-white' : 'bg-secondary text-foreground'
                  )}
                >
                  {index + 1}
                </span>
                <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                  {item.eyebrow}
                </div>
              </div>
              <div className="mt-4 flex items-start gap-3">
                <div
                  className={cn(
                    'mt-1 h-2.5 w-2.5 rounded-full',
                    toneClasses[item.tone ?? 'default']
                  )}
                />
                <div className="min-w-0">
                  <div className="text-base font-semibold text-foreground">{item.title}</div>
                  {item.description ? (
                    <div className="mt-1 text-xs leading-5 text-muted-foreground">
                      {item.description}
                    </div>
                  ) : null}
                </div>
              </div>
              <div className="mt-4 text-sm font-medium text-foreground">
                {item.actionLabel ?? (item.href ? '打开' : '当前无后续动作')}
              </div>
            </div>
          );

          if (!item.href) {
            return <div key={item.key}>{content}</div>;
          }

          return (
            <Link key={item.key} href={item.href} className="group block">
              {content}
              <div className="pointer-events-none mt-[-2.25rem] flex justify-end px-4 pb-4 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-foreground">
                <ArrowRight className="h-4 w-4" />
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
