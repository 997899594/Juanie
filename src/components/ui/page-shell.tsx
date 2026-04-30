import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export type PageShellSize = 'narrow' | 'form' | 'content' | 'section' | 'wide' | 'workspace';
export type PageShellSpacing = 'tight' | 'normal' | 'loose';

interface PageShellProps {
  children: ReactNode;
  className?: string;
  size?: PageShellSize;
  spacing?: PageShellSpacing;
}

const pageShellSizeClassName: Record<PageShellSize, string> = {
  narrow: 'max-w-3xl',
  form: 'max-w-4xl',
  content: 'max-w-5xl',
  section: 'max-w-6xl',
  wide: 'max-w-7xl',
  workspace: 'max-w-[1400px]',
};

const pageShellSpacingClassName: Record<PageShellSpacing, string> = {
  tight: 'space-y-5',
  normal: 'space-y-6',
  loose: 'space-y-8',
};

export function PageShell({
  children,
  className,
  size = 'section',
  spacing = 'normal',
}: PageShellProps) {
  return (
    <div
      className={cn(
        'mx-auto w-full',
        pageShellSizeClassName[size],
        pageShellSpacingClassName[spacing],
        className
      )}
    >
      {children}
    </div>
  );
}

type PagePanelElement = 'div' | 'section' | 'article' | 'aside';
type PagePanelVariant = 'panel' | 'surface' | 'floating' | 'card' | 'muted' | 'plain';
type PagePanelPadding = 'none' | 'sm' | 'md' | 'lg';

interface PagePanelProps {
  children: ReactNode;
  as?: PagePanelElement;
  className?: string;
  padding?: PagePanelPadding;
  variant?: PagePanelVariant;
}

const pagePanelVariantClassName: Record<PagePanelVariant, string> = {
  panel: 'console-panel',
  surface: 'console-surface',
  floating: 'ui-floating',
  card: 'console-card',
  muted: 'ui-control-muted',
  plain: '',
};

const pagePanelPaddingClassName: Record<PagePanelPadding, string> = {
  none: '',
  sm: 'px-4 py-3',
  md: 'px-5 py-5',
  lg: 'px-6 py-6 sm:px-7',
};

export function PagePanel({
  children,
  as: Component = 'section',
  className,
  padding = 'md',
  variant = 'panel',
}: PagePanelProps) {
  return (
    <Component
      className={cn(
        pagePanelVariantClassName[variant],
        pagePanelPaddingClassName[padding],
        className
      )}
    >
      {children}
    </Component>
  );
}
