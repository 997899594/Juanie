'use client';

import Link from 'next/link';
import type { ComponentType, ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { Button, type ButtonProps } from './button';

type PlatformNavTone = 'rail' | 'pill' | 'sheet' | 'bottom';

interface PlatformNavItemProps {
  href: string;
  label: ReactNode;
  icon?: ComponentType<{ className?: string }>;
  active?: boolean;
  tone?: PlatformNavTone;
  onClick?: () => void;
  className?: string;
}

const platformNavBaseClassName =
  'group inline-flex items-center font-medium transition-colors focus-visible:ring-2 focus-visible:ring-ring/15';

const platformNavToneClassName: Record<PlatformNavTone, string> = {
  rail: 'flex w-full gap-3 rounded-2xl px-3 py-3 text-sm',
  pill: 'gap-2 rounded-full px-3 py-1.5 text-xs shadow-[0_1px_0_rgba(255,255,255,0.72)_inset,0_6px_16px_rgba(55,53,47,0.03)]',
  sheet:
    'flex w-full gap-3 rounded-[20px] px-4 py-3.5 text-sm shadow-[0_1px_0_rgba(255,255,255,0.72)_inset,0_8px_20px_rgba(55,53,47,0.028)]',
  bottom:
    'flex min-h-12 w-full flex-col justify-center gap-1 rounded-[18px] px-2 py-1.5 text-[11px]',
};

const platformNavActiveClassName: Record<PlatformNavTone, string> = {
  rail: 'bg-secondary text-foreground',
  pill: 'bg-secondary text-foreground',
  sheet: 'bg-secondary text-foreground',
  bottom: 'bg-secondary text-foreground',
};

const platformNavIdleClassName: Record<PlatformNavTone, string> = {
  rail: 'text-muted-foreground hover:bg-sidebar-accent hover:text-foreground',
  pill: 'bg-card/90 text-muted-foreground hover:bg-secondary hover:text-foreground',
  sheet: 'bg-card text-foreground hover:bg-secondary',
  bottom: 'text-muted-foreground hover:bg-secondary/80 hover:text-foreground',
};

const platformNavIconClassName: Record<PlatformNavTone, string> = {
  rail: 'h-4 w-4',
  pill: 'h-3.5 w-3.5',
  sheet: 'h-4 w-4',
  bottom: 'h-4 w-4',
};

export function PlatformNavItem({
  href,
  label,
  icon: Icon,
  active = false,
  tone = 'rail',
  onClick,
  className,
}: PlatformNavItemProps) {
  return (
    <Link
      href={href}
      onClick={onClick}
      aria-current={active ? 'page' : undefined}
      className={cn(
        platformNavBaseClassName,
        platformNavToneClassName[tone],
        active ? platformNavActiveClassName[tone] : platformNavIdleClassName[tone],
        className
      )}
    >
      {Icon ? <Icon className={platformNavIconClassName[tone]} /> : null}
      <span className="truncate">{label}</span>
    </Link>
  );
}

export function PlatformNavLabel({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'mb-2 px-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground',
        className
      )}
    >
      {children}
    </div>
  );
}

interface BackActionProps extends Omit<ButtonProps, 'asChild' | 'children' | 'size' | 'variant'> {
  label?: string;
  href?: string;
  icon: ReactNode;
  size?: 'sm' | 'default';
}

export function BackAction({
  label = '返回',
  href,
  icon,
  size = 'default',
  className,
  ...props
}: BackActionProps) {
  return (
    <Button
      variant="ghost"
      size={size}
      className={cn(
        'justify-start text-muted-foreground hover:text-foreground',
        size === 'sm' ? 'h-9 px-3 text-sm' : 'h-10 px-4',
        className
      )}
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
  );
}
