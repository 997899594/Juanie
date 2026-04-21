'use client';

import { Badge } from '@/components/ui/badge';
import type { PreviewSourceMetadata } from '@/lib/environments/source-metadata';
import { cn } from '@/lib/utils';

interface PreviewSourceSummaryProps {
  meta: PreviewSourceMetadata;
  className?: string;
  truncate?: boolean;
}

export function PreviewSourceSummary({
  meta,
  className,
  truncate = false,
}: PreviewSourceSummaryProps) {
  if (!meta.title && !meta.detail && !meta.stateLabel) {
    return null;
  }

  return (
    <div
      className={cn('flex flex-wrap items-center gap-2 text-xs text-muted-foreground', className)}
    >
      {meta.title && (
        <span className={cn(truncate && 'truncate')}>
          {meta.title}
          {meta.reference ? ` · ${meta.reference}` : ''}
        </span>
      )}
      {meta.detail &&
        (meta.webUrl ? (
          <a
            href={meta.webUrl}
            target="_blank"
            rel="noreferrer"
            className={cn('text-foreground underline underline-offset-4', truncate && 'truncate')}
          >
            {meta.detail}
          </a>
        ) : (
          <span className={cn(truncate && 'truncate')}>{meta.detail}</span>
        ))}
      {meta.authorName && <span>{meta.authorName}</span>}
      {meta.stateLabel && (
        <Badge variant="secondary" className="rounded-full px-2 py-0.5 text-[11px]">
          {meta.stateLabel}
        </Badge>
      )}
    </div>
  );
}
