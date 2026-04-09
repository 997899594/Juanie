export interface ReleasePlanningViewLike {
  canCreate: boolean;
  blockingReason: string | null;
  summary: string | null;
  issue: {
    code: string;
    kind: 'approval' | 'migration' | 'deployment' | 'environment' | 'release';
    label: string;
    summary: string;
    nextActionLabel: string;
  } | null;
  platformSignals: {
    chips: Array<{
      key: string;
      label: string;
      tone: 'danger' | 'neutral';
    }>;
    primarySummary: string | null;
    nextActionLabel: string | null;
  };
  releasePolicy: {
    requiresApproval: boolean;
    primarySignal: {
      code: string;
      kind: 'environment' | 'release';
      level: 'protected' | 'preview' | 'approval_required' | 'progressive';
      label: string;
      summary: string;
      nextActionLabel: string | null;
    } | null;
  };
  environmentPolicy: {
    primarySignal: {
      code: string;
      kind: 'environment' | 'release';
      level: 'protected' | 'preview' | 'approval_required' | 'progressive';
      label: string;
      summary: string;
      nextActionLabel: string | null;
    } | null;
  };
  migration: {
    preDeployCount: number;
    postDeployCount: number;
    automaticCount: number;
    manualPlatformCount: number;
    externalCount: number;
    warnings: string[];
    requiresExternalCompletion?: boolean;
    primarySignal: {
      code: string;
      kind: 'migration';
      level: 'warning' | 'approval_required';
      label: string;
      summary: string;
      nextActionLabel: string | null;
    } | null;
  };
}

export interface ReleasePlanningPanelChip {
  key: string;
  label: string;
  tone: 'danger' | 'neutral';
}

export interface ReleasePlanningPanel {
  chips: ReleasePlanningPanelChip[];
  warningChips: ReleasePlanningPanelChip[];
  issueSummary: string | null;
  nextActionLabel: string | null;
  blockingReason: string | null;
  sourceImageUrl: string | null;
  canSubmit: boolean;
}

export function buildReleasePlanningPanel(input: {
  plan: ReleasePlanningViewLike;
  sourceCommitSha?: string | null;
  sourceImageUrl?: string | null;
}): ReleasePlanningPanel {
  const chips: ReleasePlanningPanelChip[] = input.plan.platformSignals.chips.map((chip) => ({
    key: chip.key,
    label: chip.label,
    tone: chip.tone,
  }));

  if (input.plan.migration.preDeployCount > 0) {
    chips.push({
      key: 'pre-deploy',
      label: `前置迁移 ${input.plan.migration.preDeployCount} 项`,
      tone: 'neutral',
    });
  }

  if (input.plan.migration.postDeployCount > 0) {
    chips.push({
      key: 'post-deploy',
      label: `后置迁移 ${input.plan.migration.postDeployCount} 项`,
      tone: 'neutral',
    });
  }

  if (input.plan.migration.manualPlatformCount > 0) {
    chips.push({
      key: 'manual-platform',
      label: `平台手动 ${input.plan.migration.manualPlatformCount} 项`,
      tone: 'danger',
    });
  }

  if (input.plan.migration.externalCount > 0) {
    chips.push({
      key: 'external-completion',
      label: `外部确认 ${input.plan.migration.externalCount} 项`,
      tone: 'danger',
    });
  }

  if (input.sourceCommitSha) {
    chips.push({
      key: 'source-sha',
      label: `来源 ${input.sourceCommitSha.slice(0, 7)}`,
      tone: 'neutral',
    });
  }

  return {
    chips,
    warningChips: input.plan.migration.warnings.map((warning) => ({
      key: warning,
      label: warning,
      tone: 'neutral',
    })),
    issueSummary: input.plan.platformSignals.primarySummary,
    nextActionLabel: input.plan.platformSignals.nextActionLabel,
    blockingReason: input.plan.blockingReason,
    sourceImageUrl: input.sourceImageUrl ?? null,
    canSubmit: input.plan.canCreate && !input.plan.blockingReason,
  };
}
