import type { ComponentType } from 'react';
import { cn } from '@/lib/utils';
import { PlatformNavItem } from './platform-navigation';

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
          <PlatformNavItem
            key={item.href}
            href={item.href}
            icon={Icon}
            label={item.label}
            active={item.isActive}
            tone="pill"
            className={cn(
              itemSizeClassName[size],
              item.isActive && tone === 'inverted' && activeToneClassName.inverted,
              item.isActive && tone === 'primary' && activeToneClassName.primary
            )}
          />
        );
      })}
    </nav>
  );
}
