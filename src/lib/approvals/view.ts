import { buildEnvironmentAccessUrl, pickPrimaryEnvironmentDomain } from '@/lib/domains/defaults';
import {
  buildPreviewLifecycleSummary,
  type PreviewLifecycleSummary,
} from '@/lib/environments/lifecycle-summary';
import {
  formatEnvironmentExpiry,
  getEnvironmentScopeLabel,
  getEnvironmentSourceLabel,
} from '@/lib/environments/presentation';
import type { PreviewReviewMetadata } from '@/lib/environments/review-metadata';
import {
  buildPreviewSourceMetadata,
  type PreviewSourceMetadata,
} from '@/lib/environments/source-metadata';
import type { AttentionFilterState } from '@/lib/migrations/attention';
import type { MigrationFilePreviewSnapshot } from '@/lib/migrations/file-preview';
import {
  buildIssueSnapshot,
  getIssueLabel,
  getMigrationAttentionIssueCode,
  getReleaseActionLabel,
  type ReleaseIssueCode,
  type ReleaseIssueSnapshot,
} from '@/lib/releases/intelligence';
import { getMigrationStatusDecoration } from '@/lib/releases/status-presentation';
import { buildPlatformSignalSnapshot, type PlatformSignalSnapshot } from '@/lib/signals/platform';
import { formatPlatformDateTime } from '@/lib/time/format';

export interface ApprovalStat {
  label: string;
  value: number;
}

export interface ApprovalRunLike {
  id: string;
  projectId: string;
  releaseId?: string | null;
  serviceId?: string | null;
  status: string;
  createdAt: Date | string;
  errorMessage?: string | null;
  database: {
    name: string;
    type: string;
  };
  environment: {
    name: string;
    branch?: string | null;
    previewPrNumber?: number | null;
    expiresAt?: Date | string | null;
    domains?: Array<{
      hostname: string;
      isPrimary?: boolean | null;
    }> | null;
    isPreview?: boolean | null;
  };
  project: {
    name: string;
  };
  service?: {
    name?: string | null;
  } | null;
  specification: {
    tool: string;
    phase: string;
    command: string;
    executionMode?: string | null;
    workingDirectory?: string | null;
    migrationPath?: string | null;
    lockStrategy?: string | null;
    compatibility?: string | null;
    approvalPolicy?: string | null;
    filePreview?: MigrationFilePreviewSnapshot | null;
  };
  release?: {
    sourceRef?: string | null;
    artifacts?: Array<{
      serviceId?: string | null;
      imageUrl?: string | null;
    }> | null;
  } | null;
  previewReviewMetadata?: PreviewReviewMetadata | null;
}

export interface ApprovalItemDecorations {
  platformSignals: PlatformSignalSnapshot;
  issue: ReleaseIssueSnapshot | null;
  issueCode: ReleaseIssueCode | null;
  issueLabel: string | null;
  actionLabel: string | null;
  environmentScope: string | null;
  environmentSource: string | null;
  environmentExpiry: string | null;
  primaryDomainUrl: string | null;
  imageUrl: string | null;
  createdAtLabel: string;
  branchLabel: string;
  previewSourceMeta: PreviewSourceMetadata;
  previewLifecycle: PreviewLifecycleSummary | null;
}

export function formatApprovalStatusLabel(value: string): string {
  return getMigrationStatusDecoration(value).label ?? value;
}

export function buildApprovalsFilterHref(state: string): string {
  return state === 'all' ? '/approvals' : `/approvals?state=${state}`;
}

export function normalizeApprovalFilterState(state?: string): AttentionFilterState {
  return state === 'approval' || state === 'external' || state === 'failed' || state === 'canceled'
    ? state
    : 'all';
}

export function buildApprovalStats(input: {
  total: number;
  approval: number;
  external: number;
  failed: number;
  canceled: number;
}): ApprovalStat[] {
  return [
    { label: '待处理', value: input.total },
    { label: '待审批', value: input.approval },
    { label: '待外部完成', value: input.external },
    { label: '失败', value: input.failed },
    { label: '已取消', value: input.canceled },
  ];
}

export function decorateApprovalRuns<TRun extends ApprovalRunLike>(
  runs: TRun[]
): Array<TRun & ApprovalItemDecorations> {
  return runs.map((run) => {
    const issueCode = getMigrationAttentionIssueCode(run);
    const issue = buildIssueSnapshot(issueCode);
    const primaryDomain = pickPrimaryEnvironmentDomain(
      (run.environment.domains ?? []).map((domain, index) => ({
        id: `${index}`,
        hostname: domain.hostname,
        isPrimary: domain.isPrimary ?? null,
      }))
    );
    const imageUrl =
      run.release?.artifacts?.find((artifact) => artifact.serviceId === run.serviceId)?.imageUrl ??
      null;
    const previewSourceMeta = buildPreviewSourceMetadata({
      sourceRef: run.release?.sourceRef,
      environment: run.environment,
      reviewRequest: run.previewReviewMetadata ?? null,
    });
    const environmentSource = getEnvironmentSourceLabel(run.environment);
    const environmentExpiry = formatEnvironmentExpiry(run.environment.expiresAt);
    const primaryDomainUrl = primaryDomain
      ? buildEnvironmentAccessUrl(primaryDomain.hostname)
      : null;
    const previewLifecycle = run.environment.isPreview
      ? buildPreviewLifecycleSummary({
          sourceLabel: previewSourceMeta.label ?? environmentSource,
          expiryLabel: environmentExpiry,
          primaryDomainUrl,
        })
      : null;

    return {
      ...run,
      platformSignals: buildPlatformSignalSnapshot({
        issue,
        previewLifecycle,
      }),
      issue,
      issueCode,
      issueLabel: issue?.label ?? getIssueLabel(issueCode),
      actionLabel: issue?.nextActionLabel ?? getReleaseActionLabel(issueCode),
      environmentScope: getEnvironmentScopeLabel(run.environment),
      environmentSource,
      environmentExpiry,
      primaryDomainUrl,
      imageUrl,
      createdAtLabel: formatPlatformDateTime(run.createdAt) ?? '—',
      branchLabel: run.release?.sourceRef ?? run.environment.branch ?? '未设置',
      previewSourceMeta,
      previewLifecycle,
    };
  });
}
