import Link from 'next/link';
import type { ComponentType } from 'react';
import { cn } from '@/lib/utils';

export interface SectionNavItem {
  href: string;
  label: string;
  isActive?: boolean;
  icon?: ComponentType<{ className?: string }>;
}

interface SectionNavProps {
  items: SectionNavItem[];
  className?: string;
  size?: 'sm' | 'md';
  tone?: 'primary' | 'inverted';
}

const itemSizeClassName = {
  sm: 'gap-1.5 px-3 py-2 text-xs',
  md: 'gap-2 px-4 py-2 text-sm',
} as const;

const activeToneClassName = {
  primary: 'bg-primary text-primary-foreground',
  inverted: 'bg-foreground text-background shadow-[0_8px_20px_rgba(55,53,47,0.14)]',
} as const;

export function SectionNav({ items, className, size = 'md', tone = 'primary' }: SectionNavProps) {
  if (items.length === 0) {
    return null;
  }

  return (
    <nav className={cn('ui-floating flex flex-wrap items-center gap-2 px-3 py-3', className)}>
      {items.map((item) => {
        const Icon = item.icon;

        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              'inline-flex items-center rounded-full font-medium transition-colors',
              itemSizeClassName[size],
              item.isActive
                ? activeToneClassName[tone]
                : 'bg-transparent text-muted-foreground hover:bg-white/80 hover:text-foreground'
            )}
          >
            {Icon ? <Icon className="h-3.5 w-3.5" /> : null}
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
