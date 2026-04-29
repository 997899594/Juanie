import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface DetailsSectionProps {
  title: string;
  summary?: string;
  children: ReactNode;
  className?: string;
  contentClassName?: string;
}

export function DetailsSection({
  title,
  summary,
  children,
  className,
  contentClassName,
}: DetailsSectionProps) {
  return (
    <details className={className}>
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-sm font-medium text-foreground [&::-webkit-details-marker]:hidden">
        <span>{title}</span>
        <span className="text-xs font-normal text-muted-foreground">展开</span>
      </summary>
      <div className={cn('mt-4 space-y-4', contentClassName)}>
        {summary ? <div className="text-sm text-muted-foreground">{summary}</div> : null}
        {children}
      </div>
    </details>
  );
}
