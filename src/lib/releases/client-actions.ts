import type { ReleaseServiceInput } from '@/lib/releases';
import type { PromotionPlanSnapshot, ReleasePlanningSnapshot } from '@/lib/releases/planning';

interface ApiErrorResponse {
  error?: string;
  releaseId?: string;
  releasePath?: string | null;
  release?: {
    id?: string;
    releasePath?: string | null;
  } | null;
}

export class ReleaseClientActionError extends Error {
  readonly releaseId?: string;
  readonly releasePath?: string | null;

  constructor(
    message: string,
    options?: {
      releaseId?: string;
      releasePath?: string | null;
    }
  ) {
    super(message);
    this.name = 'ReleaseClientActionError';
    this.releaseId = options?.releaseId;
    this.releasePath = options?.releasePath;
  }
}

async function parseJsonResponse<T>(response: Response, fallbackMessage: string): Promise<T> {
  const data = (await response.json().catch(() => null)) as (T & ApiErrorResponse) | null;

  if (!response.ok) {
    throw new ReleaseClientActionError(data?.error || fallbackMessage, {
      releaseId: data?.releaseId ?? data?.release?.id,
      releasePath: data?.releasePath ?? data?.release?.releasePath ?? null,
    });
  }

  return (data ?? {}) as T;
}

export interface ManualReleasePlanResponse {
  plan: {
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
  };
}

export interface EnvironmentRollbackCandidateResponse {
  id: string;
  sourceRef: string;
  sourceCommitSha: string | null;
  configCommitSha: string | null;
  summary: string | null;
  createdAt: string;
  artifacts: Array<{
    service: {
      id: string;
      name: string;
    };
    imageUrl: string;
    imageDigest: string | null;
  }>;
}

export interface EnvironmentRollbackPlanResponse {
  sourceRelease: EnvironmentRollbackCandidateResponse | null;
  candidates: EnvironmentRollbackCandidateResponse[];
  currentRelease: {
    id: string;
    status: string;
    commitSha: string | null;
  } | null;
  plan: ReleasePlanningSnapshot;
}

export interface DeploymentRolloutPlanResponse {
  deployment: {
    id: string;
    serviceId: string;
    serviceName?: string;
    stableName?: string;
    candidateName?: string;
    candidateImage?: string | null;
    stableExists?: boolean;
  } | null;
  plan: {
    canFinalize: boolean;
    blockingReason: string | null;
    strategyLabel: string | null;
    platformSignals: {
      chips: Array<{
        key: string;
        label: string;
        tone: 'danger' | 'neutral';
      }>;
      primarySummary: string | null;
      nextActionLabel: string | null;
    };
  };
}

export interface PromoteReleaseResponse {
  success: boolean;
  releaseId?: string;
  releasePath?: string | null;
  tagName?: string | null;
  promotionFlowId?: string | null;
  targetEnvironmentId?: string | null;
  targetEnvironmentName?: string | null;
}

export type PromotionPlanResponse = PromotionPlanSnapshot;

export interface MigrationRunActionResponse {
  message: string;
  runId: string;
}

export async function approveReleaseMigrationPlan(input: {
  projectId: string;
  releaseId: string;
  approvalToken: string;
}): Promise<{ message: string; planId: string }> {
  const response = await fetch(
    `/api/projects/${input.projectId}/releases/${input.releaseId}/migration-plan`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'approve', approvalToken: input.approvalToken }),
    }
  );
  return parseJsonResponse(response, '迁移计划审批失败');
}

export async function fetchManualReleasePlan(input: {
  projectId: string;
  environmentId: string;
  sourceRef: string;
  sourceCommitSha?: string | null;
  summary?: string | null;
  services: ReleaseServiceInput[];
}): Promise<ManualReleasePlanResponse> {
  const response = await fetch(`/api/projects/${input.projectId}/releases`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      dryRun: true,
      environmentId: input.environmentId,
      ref: input.sourceRef,
      commitSha: input.sourceCommitSha ?? null,
      commitMessage: input.summary ?? null,
      services: input.services,
    }),
  });

  return parseJsonResponse<ManualReleasePlanResponse>(response, '加载发布预检失败');
}

export async function createManualRelease(input: {
  projectId: string;
  environmentId: string;
  sourceReleaseId?: string | null;
  sourceRef: string;
  sourceCommitSha?: string | null;
  summary?: string | null;
  services: ReleaseServiceInput[];
}): Promise<{ id?: string; releasePath?: string | null }> {
  const response = await fetch(`/api/projects/${input.projectId}/releases`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      environmentId: input.environmentId,
      sourceReleaseId: input.sourceReleaseId ?? null,
      ref: input.sourceRef,
      commitSha: input.sourceCommitSha ?? null,
      commitMessage: input.summary ?? null,
      services: input.services,
    }),
  });

  return parseJsonResponse<{ id?: string; releasePath?: string | null }>(
    response,
    '创建手动发布失败'
  );
}

export async function fetchEnvironmentRollbackPlan(input: {
  projectId: string;
  environmentId: string;
  sourceReleaseId?: string | null;
}): Promise<EnvironmentRollbackPlanResponse> {
  const params = new URLSearchParams();
  if (input.sourceReleaseId) {
    params.set('sourceReleaseId', input.sourceReleaseId);
  }

  const query = params.toString();
  const response = await fetch(
    `/api/projects/${input.projectId}/environments/${input.environmentId}/rollback${
      query ? `?${query}` : ''
    }`
  );

  return parseJsonResponse<EnvironmentRollbackPlanResponse>(response, '加载回滚预检失败');
}

export async function createEnvironmentRollbackRelease(input: {
  projectId: string;
  environmentId: string;
  sourceReleaseId?: string | null;
}): Promise<{ releaseId?: string; releasePath?: string | null }> {
  const response = await fetch(
    `/api/projects/${input.projectId}/environments/${input.environmentId}/rollback`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        sourceReleaseId: input.sourceReleaseId ?? null,
      }),
    }
  );

  return parseJsonResponse<{ releaseId?: string; releasePath?: string | null }>(
    response,
    '创建回滚发布失败'
  );
}

export async function fetchDeploymentRolloutPlan(input: {
  projectId: string;
  deploymentId: string;
}): Promise<DeploymentRolloutPlanResponse> {
  const response = await fetch(
    `/api/projects/${input.projectId}/deployments/${input.deploymentId}/rollout`
  );

  return parseJsonResponse<DeploymentRolloutPlanResponse>(response, '加载放量预检失败');
}

export async function finalizeDeploymentRolloutAction(input: {
  projectId: string;
  deploymentId: string;
}): Promise<{
  success: boolean;
  deploymentId: string;
  imageUrl: string;
  strategyLabel: string | null;
}> {
  const response = await fetch(
    `/api/projects/${input.projectId}/deployments/${input.deploymentId}/rollout`,
    {
      method: 'POST',
    }
  );

  return parseJsonResponse<{
    success: boolean;
    deploymentId: string;
    imageUrl: string;
    strategyLabel: string | null;
  }>(response, '推进放量失败');
}

export async function createPromotionRelease(input: {
  projectId: string;
  flowId?: string | null;
}): Promise<PromoteReleaseResponse> {
  const response = await fetch(`/api/projects/${input.projectId}/promote`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      flowId: input.flowId ?? null,
    }),
  });

  return parseJsonResponse<PromoteReleaseResponse>(response, '创建提升发布失败');
}

export function buildPromotionPlanUrl(input: {
  projectId: string;
  flowId?: string | null;
  refreshSchema?: boolean;
}): string {
  const params = new URLSearchParams();
  if (input.flowId) {
    params.set('flowId', input.flowId);
  }

  if (input.refreshSchema) {
    params.set('refreshSchema', 'true');
  }

  const query = params.toString();
  return `/api/projects/${input.projectId}/promote${query ? `?${query}` : ''}`;
}

export async function fetchPromotionPlan(input: {
  projectId: string;
  flowId?: string | null;
  refreshSchema?: boolean;
}): Promise<PromotionPlanResponse> {
  const response = await fetch(buildPromotionPlanUrl(input));

  return parseJsonResponse<PromotionPlanResponse>(response, '加载提升预检失败');
}

export async function createProductionRelease(input: {
  projectId: string;
}): Promise<PromoteReleaseResponse> {
  return createPromotionRelease(input);
}

export async function executeMigrationRunAction(input: {
  projectId: string;
  runId: string;
  action: 'approve' | 'retry' | 'mark_external_complete' | 'mark_external_failed';
  approvalToken?: string | null;
}): Promise<MigrationRunActionResponse> {
  const response = await fetch(`/api/projects/${input.projectId}/migration-runs/${input.runId}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      action: input.action,
      approvalToken: input.approvalToken ?? null,
    }),
  });

  const fallbackMessage =
    input.action === 'approve'
      ? '迁移审批失败'
      : input.action === 'retry'
        ? '迁移重试失败'
        : input.action === 'mark_external_complete'
          ? '标记外部迁移完成失败'
          : '标记外部迁移失败失败';

  return parseJsonResponse<MigrationRunActionResponse>(response, fallbackMessage);
}
