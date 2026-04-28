import type { ReleaseServiceInput } from '@/lib/releases';
import type { PromotionPlanSnapshot } from '@/lib/releases/planning';

interface ApiErrorResponse {
  error?: string;
}

async function parseJsonResponse<T>(response: Response, fallbackMessage: string): Promise<T> {
  const data = (await response.json().catch(() => null)) as (T & ApiErrorResponse) | null;

  if (!response.ok) {
    throw new Error(data?.error || fallbackMessage);
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

export interface RollbackPlanResponse {
  sourceDeployment: {
    id: string;
    imageUrl: string;
    commitSha: string | null;
    environmentId: string;
    serviceId: string | null;
    branch: string | null;
  } | null;
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

export async function fetchManualReleasePlan(input: {
  projectId: string;
  environmentId: string;
  sourceRef: string;
  sourceCommitSha?: string | null;
  summary?: string | null;
  services: ReleaseServiceInput[];
}): Promise<ManualReleasePlanResponse> {
  const response = await fetch(`/api/projects/${input.projectId}/deployments`, {
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
}): Promise<{ id?: string }> {
  const response = await fetch(`/api/projects/${input.projectId}/deployments`, {
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

  return parseJsonResponse<{ id?: string }>(response, '创建手动发布失败');
}

export async function fetchRollbackPlan(input: {
  projectId: string;
  deploymentId: string;
}): Promise<RollbackPlanResponse> {
  const response = await fetch(
    `/api/projects/${input.projectId}/deployments/${input.deploymentId}/rollback`
  );

  return parseJsonResponse<RollbackPlanResponse>(response, '加载回滚预检失败');
}

export async function createRollbackRelease(input: {
  projectId: string;
  deploymentId: string;
}): Promise<{ releaseId?: string }> {
  const response = await fetch(
    `/api/projects/${input.projectId}/deployments/${input.deploymentId}/rollback`,
    {
      method: 'POST',
    }
  );

  return parseJsonResponse<{ releaseId?: string }>(response, '创建回滚发布失败');
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

export async function fetchPromotionPlan(input: {
  projectId: string;
  flowId?: string | null;
}): Promise<PromotionPlanResponse> {
  const params = new URLSearchParams();
  if (input.flowId) {
    params.set('flowId', input.flowId);
  }

  const query = params.toString();
  const response = await fetch(
    `/api/projects/${input.projectId}/promote${query ? `?${query}` : ''}`
  );

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
