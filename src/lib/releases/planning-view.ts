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
  schema: {
    checkedCount: number;
    blockingCount: number;
    summary: string | null;
    nextActionLabel: string | null;
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

function getChipSemanticKey(chip: ReleasePlanningPanelChip): string {
  if (
    chip.key === 'issue:approval_blocked' ||
    chip.label === '审批阻塞' ||
    chip.label === '需要审批'
  ) {
    return 'approval-gate';
  }

  if (chip.label === '生产环境保护') {
    return 'production-protection';
  }

  return chip.key;
}

function getChipPresentation(chip: ReleasePlanningPanelChip): ReleasePlanningPanelChip {
  if (chip.key === 'issue:approval_blocked' || chip.label === '审批阻塞') {
    return {
      ...chip,
      key: 'approval-gate',
      label: '等待审批',
    };
  }

  if (chip.label === '需要审批') {
    return {
      ...chip,
      key: 'approval-gate',
    };
  }

  return chip;
}

function mergePlanningChips(chips: ReleasePlanningPanelChip[]): ReleasePlanningPanelChip[] {
  const merged = new Map<string, ReleasePlanningPanelChip>();

  for (const rawChip of chips) {
    const chip = getChipPresentation(rawChip);
    const key = getChipSemanticKey(chip);
    const existing = merged.get(key);

    if (!existing) {
      merged.set(key, { ...chip, key });
      continue;
    }

    if (existing.label === '需要审批' && chip.label === '等待审批') {
      merged.set(key, { ...chip, key });
      continue;
    }

    if (existing.tone !== 'danger' && chip.tone === 'danger') {
      merged.set(key, { ...existing, tone: 'danger' });
    }
  }

  return Array.from(merged.values());
}

function getPlanningBlockingSummary(plan: ReleasePlanningViewLike): string | null {
  if (!plan.blockingReason) {
    return null;
  }

  if (plan.schema.blockingCount > 0 && plan.schema.summary) {
    return `${plan.blockingReason}：${plan.schema.summary}`;
  }

  if (
    plan.platformSignals.primarySummary &&
    plan.platformSignals.primarySummary !== plan.blockingReason
  ) {
    return `${plan.blockingReason}：${plan.platformSignals.primarySummary}`;
  }

  return plan.blockingReason;
}

function getPlanningIssueSummary(plan: ReleasePlanningViewLike): string | null {
  const blockingSummary = getPlanningBlockingSummary(plan);
  if (blockingSummary) {
    return blockingSummary;
  }

  if (plan.issue?.code === 'approval_blocked') {
    const migrationCount = plan.migration.preDeployCount || plan.migration.automaticCount;
    const migrationLabel = plan.migration.preDeployCount > 0 ? '生产前置迁移' : '生产迁移';
    return migrationCount > 0
      ? `这次发布包含 ${migrationCount} 个${migrationLabel}，需要在发布详情审批后才会执行。`
      : '这次发布需要在发布详情完成审批后才会继续。';
  }

  return plan.platformSignals.primarySummary;
}

function getPlanningWarningChips(plan: ReleasePlanningViewLike): ReleasePlanningPanelChip[] {
  const hiddenWarnings = new Set<string>();

  if (plan.issue?.code === 'approval_blocked') {
    hiddenWarnings.add('发布流程会等待审批，通过后才执行生产迁移。');
  }

  return Array.from(new Set(plan.migration.warnings))
    .filter((warning) => !hiddenWarnings.has(warning))
    .map((warning) => ({
      key: warning,
      label: warning,
      tone: 'neutral',
    }));
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

  if (input.plan.schema.blockingCount > 0) {
    chips.push({
      key: 'schema-blocked',
      label: `Schema 门禁 ${input.plan.schema.blockingCount} 项`,
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
    chips: mergePlanningChips(chips),
    warningChips: getPlanningWarningChips(input.plan),
    issueSummary: getPlanningIssueSummary(input.plan),
    nextActionLabel: input.plan.platformSignals.nextActionLabel,
    blockingReason: input.plan.blockingReason,
    sourceImageUrl: input.sourceImageUrl ?? null,
    canSubmit: input.plan.canCreate && !input.plan.blockingReason,
  };
}
