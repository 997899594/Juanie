import { buildEnvironmentAccessUrl, pickPrimaryEnvironmentDomain } from '@/lib/domains/defaults';
import {
  buildPreviewLifecycleSummary,
  type PreviewLifecycleSummary,
} from '@/lib/environments/lifecycle-summary';
import {
  formatEnvironmentExpiry,
  getEnvironmentDeploymentStrategyLabel,
  getEnvironmentInheritancePresentation,
  getEnvironmentSourceLabel,
  getPreviewDatabasePresentation,
} from '@/lib/environments/presentation';
import type { PreviewReviewMetadata } from '@/lib/environments/review-metadata';
import { buildPreviewSourceMetadata } from '@/lib/environments/source-metadata';
import type { InfrastructureDiagnosticsSnapshot } from '@/lib/infrastructure/diagnostics';
import {
  evaluateEnvironmentPolicy,
  evaluateReleasePolicy,
  type ReleasePolicySnapshot,
} from '@/lib/policies/delivery';
import {
  getReleaseIntelligenceSnapshot,
  type ReleaseIntelligenceSnapshot,
} from '@/lib/releases/intelligence';
import { getReleaseDisplayTitle } from '@/lib/releases/presentation';
import { getReleaseStatusLabel } from '@/lib/releases/status-presentation';
import { buildPlatformSignalSnapshot } from '@/lib/signals/platform';

export interface ReleaseSummarySnapshot {
  changed: string;
  risk: string;
  result: string;
  governance: string | null;
  nextAction: string | null;
}

export interface ReleaseBlockingReason {
  label: string;
  summary: string;
  nextActionLabel: string | null;
}

export interface ReleaseGovernanceEvent {
  key: string;
  code:
    | 'preview_deleted'
    | 'preview_cleanup_completed'
    | 'cleanup_terminating_pods'
    | 'restart_deployments';
  title: string;
  description: string;
  at: Date | string | null;
  tone: 'neutral' | 'info' | 'success' | 'warning' | 'danger';
}

export interface ReleaseRecapRecord {
  version: 1;
  generatedAt: string;
  statusLabel: string;
  headline: string;
  primarySummary: string;
  narrative: ReleaseSummarySnapshot;
  blockingReason: ReleaseBlockingReason | null;
}

export interface ReleaseRecapSourceLike {
  id: string;
  sourceRef?: string | null;
  sourceCommitSha?: string | null;
  status: string;
  errorMessage?: string | null;
  summary?: string | null;
  environment: {
    id: string;
    name?: string;
    isProduction?: boolean | null;
    isPreview?: boolean | null;
    previewPrNumber?: number | null;
    branch?: string | null;
    expiresAt?: Date | string | null;
    databaseStrategy?: 'direct' | 'inherit' | 'isolated_clone' | null;
    deploymentStrategy?: 'rolling' | 'controlled' | 'canary' | 'blue_green' | null;
    baseEnvironment?: {
      id: string;
      name: string;
    } | null;
    databases?: Array<{
      id: string;
      name: string;
      status?: string | null;
      sourceDatabaseId?: string | null;
    }> | null;
    domains?: Array<{
      id: string;
      hostname: string;
      isPrimary?: boolean | null;
      isCustom?: boolean | null;
      isVerified?: boolean | null;
    }>;
  };
  previewReviewMetadata?: PreviewReviewMetadata | null;
  artifacts: Array<{
    service: {
      id: string;
      name: string;
    };
    imageUrl: string;
  }>;
  migrationRuns: Array<{
    status: string;
    specification?: {
      compatibility?: string | null;
      approvalPolicy?: string | null;
    } | null;
  }>;
  deployments: Array<{
    status: string;
  }>;
  infrastructureDiagnostics?: InfrastructureDiagnosticsSnapshot | null;
  governanceEvents?: ReleaseGovernanceEvent[] | null;
}

function getReleaseRiskLabel(riskLevel: ReleaseIntelligenceSnapshot['riskLevel']): string {
  if (riskLevel === 'high') {
    return '高风险';
  }

  if (riskLevel === 'medium') {
    return '中风险';
  }

  return '低风险';
}

function buildReleaseNarrativeSummary(input: {
  release: ReleaseRecapSourceLike;
  intelligence: ReleaseIntelligenceSnapshot;
  platformSignals: {
    primarySummary: string | null;
    nextActionLabel: string | null;
  };
  riskLabel: string;
  approvalRunsCount: number;
  retryableRunsCount: number;
  environmentStrategy: string | null;
  previewLifecycle: PreviewLifecycleSummary | null;
  governanceEvents?: ReleaseGovernanceEvent[] | null;
}): ReleaseSummarySnapshot {
  const artifactSummary =
    input.release.artifacts.length === 0
      ? '这次发布没有镜像变更'
      : `这次发布更新了 ${input.release.artifacts.length} 个服务镜像`;
  const migrationSummary =
    input.release.migrationRuns.length > 0
      ? `，包含 ${input.release.migrationRuns.length} 个迁移步骤`
      : '';

  const risk =
    input.platformSignals.primarySummary ??
    input.intelligence.issue?.summary ??
    `${input.riskLabel}${input.environmentStrategy ? ` · ${input.environmentStrategy}` : ''}`;

  const resultParts = [getReleaseStatusLabel(input.release.status)];
  if (input.approvalRunsCount > 0) resultParts.push(`${input.approvalRunsCount} 个待审批`);
  if (input.retryableRunsCount > 0) resultParts.push(`${input.retryableRunsCount} 个可重试`);
  if (input.previewLifecycle?.stateLabel) resultParts.push(input.previewLifecycle.stateLabel);
  if ((input.governanceEvents?.length ?? 0) > 0) {
    resultParts.push(`已记录 ${input.governanceEvents?.length ?? 0} 个治理动作`);
  }

  const latestGovernanceEvent = input.governanceEvents?.[0] ?? null;
  const governance = (() => {
    if (!latestGovernanceEvent) {
      return null;
    }

    const currentIssue = input.release.infrastructureDiagnostics?.primaryIssue?.label ?? null;

    switch (latestGovernanceEvent.code) {
      case 'cleanup_terminating_pods':
        if (currentIssue === '调度不足') {
          return '平台已清理残留 Pod，但当前仍然受容量阻塞影响。';
        }
        if (currentIssue) {
          return `平台已清理残留 Pod，但当前主要阻塞已转为${currentIssue}。`;
        }
        return '平台已清理残留 Pod，当前没有明显的基础设施阻塞。';
      case 'restart_deployments':
        if (currentIssue === '运行时异常' || currentIssue === '探针失败') {
          return `平台已触发环境重启，但${currentIssue}仍未完全消除。`;
        }
        if (currentIssue) {
          return `平台已触发环境重启，当前仍需处理${currentIssue}。`;
        }
        return '平台已触发环境重启，当前未见明显基础设施阻塞。';
      case 'preview_cleanup_completed':
        return latestGovernanceEvent.description;
      case 'preview_deleted':
        return '平台后续已回收该预览环境，用于释放临时资源。';
      default:
        return latestGovernanceEvent.description;
    }
  })();

  return {
    changed: `${artifactSummary}${migrationSummary}`,
    risk,
    result: resultParts.join(' · '),
    governance,
    nextAction:
      input.platformSignals.nextActionLabel ??
      input.intelligence.issue?.nextActionLabel ??
      input.intelligence.actionLabel ??
      null,
  };
}

function buildReleaseBlockingReason(input: {
  release: ReleaseRecapSourceLike;
  intelligence: ReleaseIntelligenceSnapshot;
  governanceEvents?: ReleaseGovernanceEvent[] | null;
}): ReleaseBlockingReason | null {
  const latestGovernanceEvent = input.governanceEvents?.[0] ?? null;

  if (input.release.migrationRuns.some((run) => run.status === 'awaiting_approval')) {
    return {
      label: '迁移审批阻塞',
      summary: '这次发布已经进入迁移环节，但存在待审批的迁移步骤，因此不会继续推进部署。',
      nextActionLabel: '先处理迁移审批，再继续发布',
    };
  }

  if (input.release.migrationRuns.some((run) => run.status === 'failed')) {
    return {
      label: '迁移失败',
      summary: '发布没有卡在应用放量，而是被失败迁移直接阻塞。',
      nextActionLabel: '检查迁移命令、数据库状态并重试',
    };
  }

  if (input.release.migrationRuns.some((run) => run.status === 'canceled')) {
    return {
      label: '迁移取消',
      summary: '发布链路在迁移阶段被中断，需要先确认取消原因。',
      nextActionLabel: '恢复迁移后再继续发布',
    };
  }

  if (input.release.status === 'awaiting_rollout') {
    return {
      label: '待放量',
      summary: '候选版本已经通过部署与校验，但当前仍在等待人工完成放量或切换。',
      nextActionLabel: '完成放量后再收口发布',
    };
  }

  if (
    input.release.status === 'verification_failed' ||
    input.release.deployments.some((deployment) => deployment.status === 'verification_failed')
  ) {
    return {
      label: '校验失败',
      summary: '镜像已经部署，但运行态校验没有通过，因此平台不会把这次发布记为成功。',
      nextActionLabel: '检查校验路径、应用日志和环境入口',
    };
  }

  if (input.release.infrastructureDiagnostics?.primaryIssue) {
    const governanceSuffix = latestGovernanceEvent
      ? ` 平台最近已执行“${latestGovernanceEvent.title}”，但当前阻塞仍未解除。`
      : '';

    return {
      label: input.release.infrastructureDiagnostics.primaryIssue.label,
      summary: `${
        input.release.infrastructureDiagnostics.summary ??
        input.release.infrastructureDiagnostics.primaryIssue.summary
      }${governanceSuffix}`,
      nextActionLabel:
        input.release.infrastructureDiagnostics.nextActionLabel ??
        input.release.infrastructureDiagnostics.primaryIssue.nextActionLabel,
    };
  }

  if (input.intelligence.issue) {
    return {
      label: input.intelligence.issue.label,
      summary: input.intelligence.issue.summary,
      nextActionLabel: input.intelligence.issue.nextActionLabel,
    };
  }

  return null;
}

function buildRecapHeadline(input: {
  blockingReason: ReleaseBlockingReason | null;
  narrative: ReleaseSummarySnapshot;
}): string {
  if (input.blockingReason?.label) {
    return input.blockingReason.nextActionLabel
      ? `${input.blockingReason.label} · ${input.blockingReason.nextActionLabel}`
      : input.blockingReason.label;
  }

  if (input.narrative.governance) {
    return `${input.narrative.result} · ${input.narrative.governance}`;
  }

  return `${input.narrative.result} · ${input.narrative.risk}`;
}

export function buildReleaseRecap(release: ReleaseRecapSourceLike): ReleaseRecapRecord {
  const intelligence = getReleaseIntelligenceSnapshot(release);
  const policy: ReleasePolicySnapshot = evaluateReleasePolicy(release);
  const environmentPolicy = evaluateEnvironmentPolicy(release.environment);
  const approvalRunsCount = release.migrationRuns.filter(
    (run) => run.status === 'awaiting_approval'
  ).length;
  const retryableRunsCount = release.migrationRuns.filter((run) =>
    ['failed', 'canceled'].includes(run.status)
  ).length;
  const previewSourceMeta = buildPreviewSourceMetadata({
    sourceRef: release.sourceRef,
    environment: release.environment,
    reviewRequest: release.previewReviewMetadata ?? null,
  });
  const primaryDomain = pickPrimaryEnvironmentDomain(release.environment?.domains ?? []);
  const primaryDomainUrl = primaryDomain ? buildEnvironmentAccessUrl(primaryDomain.hostname) : null;
  const environmentSource = getEnvironmentSourceLabel(release.environment ?? {});
  const environmentStrategy = getEnvironmentDeploymentStrategyLabel(
    release.environment?.deploymentStrategy
  );
  const environmentInheritance = getEnvironmentInheritancePresentation(release.environment);
  const previewDatabase = getPreviewDatabasePresentation({
    environment: release.environment,
  });
  const environmentExpiry = formatEnvironmentExpiry(release.environment?.expiresAt);
  const previewLifecycle = release.environment?.isPreview
    ? buildPreviewLifecycleSummary({
        sourceLabel: previewSourceMeta.label ?? environmentSource,
        expiryLabel: environmentExpiry,
        primaryDomainUrl,
        latestRelease: {
          id: release.id,
          title: getReleaseDisplayTitle(release),
        },
      })
    : null;

  const platformSignals = buildPlatformSignalSnapshot({
    customSignals: [
      ...(environmentInheritance
        ? [
            {
              key: environmentInheritance.key,
              label: environmentInheritance.label,
              tone: 'neutral' as const,
            },
          ]
        : []),
      ...(previewDatabase
        ? [
            {
              key: previewDatabase.key,
              label: previewDatabase.label,
              tone: previewDatabase.tone,
            },
          ]
        : []),
    ],
    customSummary: previewDatabase?.summary ?? null,
    customNextActionLabel: previewDatabase?.nextActionLabel ?? null,
    issue: intelligence.issue,
    environmentPolicySignals: environmentPolicy.signals,
    environmentPolicySignal: environmentPolicy.primarySignal,
    releasePolicySignals: policy.signals,
    releasePolicySignal: policy.primarySignal,
    previewLifecycle,
  });

  const narrative = buildReleaseNarrativeSummary({
    release,
    intelligence,
    platformSignals,
    riskLabel: getReleaseRiskLabel(intelligence.riskLevel),
    approvalRunsCount,
    retryableRunsCount,
    environmentStrategy,
    previewLifecycle,
    governanceEvents: release.governanceEvents,
  });
  const blockingReason = buildReleaseBlockingReason({
    release,
    intelligence,
    governanceEvents: release.governanceEvents,
  });
  const headline = buildRecapHeadline({
    blockingReason,
    narrative,
  });

  return {
    version: 1,
    generatedAt: new Date().toISOString(),
    statusLabel: getReleaseStatusLabel(release.status),
    headline,
    primarySummary:
      blockingReason?.summary ??
      narrative.governance ??
      platformSignals.primarySummary ??
      narrative.risk,
    narrative,
    blockingReason,
  };
}
