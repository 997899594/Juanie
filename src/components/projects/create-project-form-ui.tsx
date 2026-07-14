'use client';

import { Check, ChevronDown, ChevronUp } from 'lucide-react';
import type { ReactNode } from 'react';
import type { CreateProjectFormProps } from '@/components/projects/use-create-project-form';
import { Button } from '@/components/ui/button';
import { DetailsSection } from '@/components/ui/details-section';
import { PlatformSignalChipList } from '@/components/ui/platform-signals';
import type { DatabaseCapability } from '@/lib/databases/capabilities';
import { cn } from '@/lib/utils';

export const DATABASE_TYPE_OPTIONS = [
  { value: 'postgresql', label: 'PostgreSQL' },
  { value: 'redis', label: 'Redis' },
  { value: 'mysql', label: 'MySQL' },
  { value: 'mongodb', label: 'MongoDB' },
] as const;

export const DATABASE_PLAN_OPTIONS = [
  { value: 'starter', label: 'Starter' },
  { value: 'standard', label: 'Standard' },
  { value: 'premium', label: 'Premium' },
] as const;

export const POSTGRES_CAPABILITY_OPTIONS: Array<{
  value: DatabaseCapability;
  label: string;
  description: string;
}> = [
  { value: 'vector', label: 'vector', description: '向量检索与 embedding' },
  { value: 'pg_trgm', label: 'pg_trgm', description: '模糊搜索与相似度匹配' },
];

export function getChoiceCardClass(selected: boolean): string {
  return cn(
    'relative cursor-pointer rounded-[20px] px-4 py-4 text-left transition-all duration-150',
    selected
      ? 'bg-[rgba(255,255,255,0.92)] shadow-[inset_0_1px_0_rgba(255,255,255,0.9),0_14px_34px_-22px_rgba(55,53,47,0.18)] ring-1 ring-[rgba(55,53,47,0.06)]'
      : 'bg-[rgba(255,255,255,0.76)] shadow-[inset_0_1px_0_rgba(255,255,255,0.78),0_10px_24px_-22px_rgba(55,53,47,0.12)] ring-1 ring-[rgba(55,53,47,0.035)] hover:bg-[rgba(255,255,255,0.88)] hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.84),0_14px_30px_-22px_rgba(55,53,47,0.16)] hover:ring-[rgba(55,53,47,0.05)]'
  );
}

export function getCompactChoiceCardClass(selected: boolean): string {
  return cn(
    'rounded-[18px] px-4 py-4 text-left transition-all duration-150',
    selected
      ? 'bg-[rgba(255,255,255,0.92)] shadow-[inset_0_1px_0_rgba(255,255,255,0.88),0_12px_28px_-22px_rgba(55,53,47,0.16)] ring-1 ring-[rgba(55,53,47,0.055)]'
      : 'bg-[rgba(255,255,255,0.74)] shadow-[inset_0_1px_0_rgba(255,255,255,0.76),0_8px_20px_-20px_rgba(55,53,47,0.1)] ring-1 ring-[rgba(55,53,47,0.03)] hover:bg-[rgba(255,255,255,0.86)] hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.82),0_12px_24px_-20px_rgba(55,53,47,0.14)] hover:ring-[rgba(55,53,47,0.045)]'
  );
}

export function getPillChoiceClass(selected: boolean, disabled = false): string {
  return cn(
    'rounded-full px-3.5 py-2 text-xs font-medium transition-all duration-150',
    disabled
      ? 'cursor-not-allowed bg-[rgba(255,255,255,0.42)] text-muted-foreground/70 opacity-45 shadow-[0_1px_0_rgba(255,255,255,0.68)_inset]'
      : selected
        ? 'bg-primary text-primary-foreground shadow-[0_10px_24px_rgba(55,53,47,0.16)]'
        : 'bg-[rgba(255,255,255,0.78)] text-muted-foreground shadow-[0_1px_0_rgba(255,255,255,0.78)_inset,0_6px_18px_rgba(55,53,47,0.03)] hover:bg-[rgba(255,255,255,0.94)] hover:text-foreground'
  );
}

export const reviewShellClassName = 'console-panel px-5 py-5';

export const reviewSubtleClassName = 'console-inset rounded-[16px] px-4 py-4';

interface SectionHeadingProps {
  title: string;
  description?: string;
}

export function SectionHeading({ title, description }: SectionHeadingProps) {
  return (
    <div className="space-y-1">
      <h3 className="text-sm font-medium text-foreground">{title}</h3>
      {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
    </div>
  );
}

interface ChoiceCardButtonProps {
  title: string;
  description?: string;
  selected: boolean;
  onClick: () => void;
  icon?: ReactNode;
  dense?: boolean;
  disabled?: boolean;
  className?: string;
}

export function ChoiceCardButton({
  title,
  description,
  selected,
  onClick,
  icon,
  dense = false,
  disabled = false,
  className,
}: ChoiceCardButtonProps) {
  return (
    <Button
      type="button"
      variant="ghost"
      onClick={onClick}
      aria-pressed={selected}
      disabled={disabled}
      className={cn(
        dense ? getCompactChoiceCardClass(selected) : getChoiceCardClass(selected),
        'h-auto w-full items-start justify-start px-5 py-5 text-left whitespace-normal',
        disabled && 'cursor-not-allowed opacity-45',
        className
      )}
    >
      <div className="flex w-full flex-col items-start gap-3">
        <div className="flex w-full items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2 font-medium text-foreground">
            {icon}
            <span className="min-w-0 break-words">{title}</span>
          </div>
          {selected ? (
            <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[rgba(55,53,47,0.92)] text-background shadow-[0_6px_16px_rgba(55,53,47,0.12)]">
              <Check className="h-3.5 w-3.5" />
            </span>
          ) : null}
        </div>
        {description ? (
          <div className="min-w-0 break-words text-sm text-muted-foreground">{description}</div>
        ) : null}
      </div>
    </Button>
  );
}

interface DisclosurePanelProps {
  title: string;
  meta?: string;
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
}

export function DisclosurePanel({ title, meta, open, onToggle, children }: DisclosurePanelProps) {
  return (
    <div className={cn(reviewShellClassName, 'overflow-hidden px-0 py-0')}>
      <Button
        type="button"
        variant="ghost"
        onClick={onToggle}
        className="h-auto w-full justify-between rounded-none px-4 py-4 text-left text-foreground hover:bg-transparent"
      >
        <div className="text-sm font-medium">{title}</div>
        <div className="flex items-center gap-3">
          {meta ? <span className="text-xs text-muted-foreground">{meta}</span> : null}
          {open ? (
            <ChevronUp className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          )}
        </div>
      </Button>

      {open ? <div className="console-divider-top space-y-4 px-5 py-4">{children}</div> : null}
    </div>
  );
}

export function TeamAccessDetails({
  team,
}: {
  team: CreateProjectFormProps['teamScopes'][number];
}) {
  return (
    <DetailsSection
      title="权限与授权"
      className={cn(reviewShellClassName, 'px-4 py-3')}
      contentClassName="space-y-3"
    >
      <div className="grid gap-3 text-sm md:grid-cols-3">
        <div className={reviewSubtleClassName}>
          <div className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
            当前角色
          </div>
          <div className="mt-2 font-medium text-foreground">{team.roleLabel}</div>
        </div>
        <div className={reviewSubtleClassName}>
          <div className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
            导入仓库
          </div>
          <div className="mt-2 text-muted-foreground">{team.importSummary}</div>
        </div>
        <div className={reviewSubtleClassName}>
          <div className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
            新建仓库
          </div>
          <div className="mt-2 text-muted-foreground">{team.createSummary}</div>
        </div>
      </div>
      <div className="text-xs text-muted-foreground">
        {team.providerLabels.length
          ? `代码托管授权：${team.providerLabels.join(' / ')}`
          : '还没有可用代码托管授权'}
      </div>
      <PlatformSignalChipList chips={[...team.importSignals.chips, ...team.createSignals.chips]} />
    </DetailsSection>
  );
}
