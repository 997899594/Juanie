import type { PreviewLifecycleSummary } from '@/lib/environments/lifecycle-summary';
import type { PolicySignalSnapshot } from '@/lib/policies/delivery';

export interface PlatformSignalChip {
  key: string;
  label: string;
  tone: 'danger' | 'neutral';
}

export interface PlatformSignalSnapshot {
  chips: PlatformSignalChip[];
  primarySummary: string | null;
  nextActionLabel: string | null;
}

interface BuildPlatformSignalInput {
  issue?: {
    code: string;
    label: string;
    summary: string;
    nextActionLabel: string | null;
  } | null;
  customSignals?: PlatformSignalChip[] | null;
  customSummary?: string | null;
  customNextActionLabel?: string | null;
  environmentPolicySignals?: PolicySignalSnapshot[] | null;
  environmentPolicySignal?: PolicySignalSnapshot | null;
  releasePolicySignals?: PolicySignalSnapshot[] | null;
  releasePolicySignal?: PolicySignalSnapshot | null;
  migrationPolicySignals?: Array<{
    code: string;
    label: string;
    summary: string;
    nextActionLabel: string | null;
    level: 'warning' | 'approval_required';
  }> | null;
  migrationPolicySignal?: {
    code: string;
    label: string;
    summary: string;
    nextActionLabel: string | null;
    level: 'warning' | 'approval_required';
  } | null;
  previewLifecycle?: PreviewLifecycleSummary | null;
}

function pushChip(
  chips: PlatformSignalChip[],
  seen: Set<string>,
  chip: PlatformSignalChip | null
): void {
  if (!chip || seen.has(chip.key)) {
    return;
  }

  seen.add(chip.key);
  chips.push(chip);
}

export function buildPlatformSignalSnapshot(
  input: BuildPlatformSignalInput
): PlatformSignalSnapshot {
  const chips: PlatformSignalChip[] = [];
  const seen = new Set<string>();

  for (const chip of input.customSignals ?? []) {
    pushChip(chips, seen, chip);
  }

  pushChip(
    chips,
    seen,
    input.issue
      ? {
          key: `issue:${input.issue.code}`,
          label: input.issue.label,
          tone: 'danger',
        }
      : null
  );

  pushChip(chips, seen, null);
  for (const signal of input.migrationPolicySignals ?? []) {
    pushChip(chips, seen, {
      key: `migration:${signal.code}`,
      label: signal.label,
      tone: signal.level === 'approval_required' ? 'danger' : 'neutral',
    });
  }
  pushChip(
    chips,
    seen,
    input.migrationPolicySignal
      ? {
          key: `migration:${input.migrationPolicySignal.code}`,
          label: input.migrationPolicySignal.label,
          tone: input.migrationPolicySignal.level === 'approval_required' ? 'danger' : 'neutral',
        }
      : null
  );

  for (const signal of input.releasePolicySignals ?? []) {
    pushChip(chips, seen, {
      key: `release-policy:${signal.code}`,
      label: signal.label,
      tone: signal.level === 'approval_required' ? 'danger' : 'neutral',
    });
  }
  pushChip(
    chips,
    seen,
    input.releasePolicySignal
      ? {
          key: `release-policy:${input.releasePolicySignal.code}`,
          label: input.releasePolicySignal.label,
          tone: input.releasePolicySignal.level === 'approval_required' ? 'danger' : 'neutral',
        }
      : null
  );

  for (const signal of input.environmentPolicySignals ?? []) {
    pushChip(chips, seen, {
      key: `environment-policy:${signal.code}`,
      label: signal.label,
      tone: 'neutral',
    });
  }
  pushChip(
    chips,
    seen,
    input.environmentPolicySignal
      ? {
          key: `environment-policy:${input.environmentPolicySignal.code}`,
          label: input.environmentPolicySignal.label,
          tone: 'neutral',
        }
      : null
  );

  pushChip(
    chips,
    seen,
    input.previewLifecycle
      ? {
          key: `preview:${input.previewLifecycle.stateLabel}`,
          label: input.previewLifecycle.stateLabel,
          tone: 'neutral',
        }
      : null
  );

  return {
    chips,
    primarySummary:
      input.issue?.summary ??
      input.customSummary ??
      input.migrationPolicySignal?.summary ??
      input.releasePolicySignal?.summary ??
      input.environmentPolicySignal?.summary ??
      input.previewLifecycle?.summary ??
      null,
    nextActionLabel:
      input.issue?.nextActionLabel ??
      input.customNextActionLabel ??
      input.migrationPolicySignal?.nextActionLabel ??
      input.releasePolicySignal?.nextActionLabel ??
      input.environmentPolicySignal?.nextActionLabel ??
      input.previewLifecycle?.nextActionLabel ??
      null,
  };
}
