import { ArrowRight } from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';

export interface PriorityDeckItem {
  key: string;
  eyebrow?: string;
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

export function PriorityDeck({ title, items, className }: PriorityDeckProps) {
  if (items.length === 0) {
    return null;
  }

  return (
    <section className={cn('console-panel overflow-hidden', className)}>
      <div className="px-4 py-3">
        <div className="text-sm font-semibold text-foreground">{title}</div>
      </div>
      <div className="grid gap-2.5 p-2.5 xl:grid-cols-3">
        {items.map((item) => {
          const content = (
            <div
              className={cn(
                'console-surface flex h-full flex-col rounded-[18px] px-3.5 py-3.5 transition-colors',
                item.href ? 'hover:bg-secondary/70' : ''
              )}
            >
              <div className="flex items-start gap-3">
                <div
                  className={cn('mt-1 h-2 w-2 rounded-full', toneClasses[item.tone ?? 'default'])}
                />
                <div className="min-w-0">
                  {item.eyebrow ? (
                    <div className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                      {item.eyebrow}
                    </div>
                  ) : null}
                  <div className="text-sm font-semibold text-foreground">{item.title}</div>
                </div>
              </div>
              <div className="mt-3 text-sm text-muted-foreground">
                {item.actionLabel ?? (item.href ? '进入' : '')}
              </div>
            </div>
          );

          if (!item.href) {
            return <div key={item.key}>{content}</div>;
          }

          return (
            <Link key={item.key} href={item.href} className="group block">
              {content}
              <div className="pointer-events-none mt-[-2rem] flex justify-end px-3.5 pb-3.5 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-foreground">
                <ArrowRight className="h-4 w-4" />
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
