import { cn } from '@/lib/utils';

export interface PlatformSignalChipLike {
  key: string;
  label: string;
  tone: 'danger' | 'neutral';
}

interface PlatformSignalChipListProps {
  chips: PlatformSignalChipLike[];
  className?: string;
}

export function PlatformSignalChipList({ chips, className }: PlatformSignalChipListProps) {
  if (chips.length === 0) {
    return null;
  }

  return (
    <div className={cn('flex flex-wrap gap-2 text-xs', className)}>
      {chips.map((chip) => (
        <span
          key={chip.key}
          className={cn(
            'rounded-full px-2.5 py-1 shadow-[0_1px_2px_rgba(55,53,47,0.03)]',
            chip.tone === 'danger'
              ? 'bg-[rgba(196,85,77,0.12)] text-destructive'
              : 'bg-[rgba(255,255,255,0.84)] text-foreground'
          )}
        >
          {chip.label}
        </span>
      ))}
    </div>
  );
}

interface PlatformSignalSummaryProps {
  summary?: string | null;
  nextActionLabel?: string | null;
  className?: string;
}

export function PlatformSignalSummary({
  summary,
  nextActionLabel,
  className,
}: PlatformSignalSummaryProps) {
  if (!summary && !nextActionLabel) {
    return null;
  }

  return (
    <div
      className={cn(
        'rounded-2xl bg-secondary/20 px-4 py-3 shadow-[0_1px_0_rgba(255,255,255,0.72)_inset,0_10px_24px_rgba(55,53,47,0.03)]',
        className
      )}
    >
      {summary && <div className="text-sm text-foreground">{summary}</div>}
      {nextActionLabel && (
        <div className={cn(summary ? 'mt-2' : null, 'text-xs text-muted-foreground')}>
          {nextActionLabel}
        </div>
      )}
    </div>
  );
}

interface PlatformSignalBlockProps {
  chips: PlatformSignalChipLike[];
  summary?: string | null;
  nextActionLabel?: string | null;
  chipsClassName?: string;
  summaryClassName?: string;
}

export function PlatformSignalBlock({
  chips,
  summary,
  nextActionLabel,
  chipsClassName,
  summaryClassName,
}: PlatformSignalBlockProps) {
  if (chips.length === 0 && !summary && !nextActionLabel) {
    return null;
  }

  return (
    <div className="space-y-2">
      <PlatformSignalChipList chips={chips} className={chipsClassName} />
      <PlatformSignalSummary
        summary={summary}
        nextActionLabel={nextActionLabel}
        className={summaryClassName}
      />
    </div>
  );
}
