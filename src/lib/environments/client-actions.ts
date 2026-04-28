interface ErrorResponse {
  error?: string;
}

async function parseJsonResponse<T>(response: Response): Promise<T> {
  const payload = (await response.json().catch(() => null)) as T | ErrorResponse | null;

  if (!response.ok) {
    const message =
      payload &&
      typeof payload === 'object' &&
      'error' in payload &&
      typeof payload.error === 'string'
        ? payload.error
        : '请求失败';
    throw new Error(message);
  }

  return payload as T;
}

export interface PreviewEnvironmentRecord {
  id: string;
  name: string;
  launchState: 'building' | 'deploying';
  releaseId: string | null;
  releaseStatus: string | null;
  releasePath: string | null;
  sourceCommitSha: string | null;
}

export interface UpdateEnvironmentStrategyInput {
  projectId: string;
  environmentId: string;
  deploymentStrategy: 'rolling' | 'controlled' | 'canary' | 'blue_green';
}

export interface EnvironmentRuntimeState {
  state: 'running' | 'sleeping' | 'partial' | 'not_deployed' | 'unknown';
  desiredReplicas: number;
  readyReplicas: number;
  workloadCount: number;
  summary: string;
  autoSleep: {
    enabled: boolean;
    idleMinutes: number | null;
    lastActivityAt: string | Date | null;
    lastSleptAt: string | Date | null;
    summary: string;
  };
}

export interface CreatePreviewEnvironmentInput {
  projectId: string;
  branch?: string;
  prNumber?: number;
  ttlHours?: number;
  databaseStrategy?: 'inherit' | 'isolated_clone';
}

export interface DeliveryRoutingRuleInput {
  id?: string;
  environmentId: string;
  kind: 'branch' | 'tag' | 'pull_request' | 'manual';
  pattern: string | null;
  priority: number;
  isActive: boolean;
  autoCreateEnvironment: boolean;
}

export interface PromotionFlowInput {
  id?: string;
  sourceEnvironmentId: string;
  targetEnvironmentId: string;
  requiresApproval: boolean;
  strategy: 'reuse_release_artifacts' | 'rebuild_from_ref';
  isActive: boolean;
}

export async function inspectDatabaseSchemaState(
  projectId: string,
  databaseId: string
): Promise<void> {
  const response = await fetch(
    `/api/projects/${projectId}/databases/${databaseId}/schema/inspect`,
    {
      method: 'POST',
    }
  );

  await parseJsonResponse<{ state: { id: string } }>(response);
}

export async function markDatabaseSchemaAligned(
  projectId: string,
  databaseId: string
): Promise<void> {
  const response = await fetch(
    `/api/projects/${projectId}/databases/${databaseId}/schema/mark-aligned`,
    {
      method: 'POST',
    }
  );

  await parseJsonResponse<{ state: { id: string } }>(response);
}

export interface DatabaseSchemaRepairPlan {
  id: string;
  kind:
    | 'no_action'
    | 'run_release_migrations'
    | 'mark_aligned'
    | 'repair_pr_required'
    | 'adopt_current_db'
    | 'manual_investigation';
  status: 'draft' | 'review_opened' | 'applied' | 'superseded' | 'failed';
  title: string;
  summary: string;
  riskLevel: 'low' | 'medium' | 'high';
  expectedVersion: string | null;
  actualVersion: string | null;
  nextActionLabel: string | null;
  steps: string[];
  generatedFiles: string[];
  branchName: string | null;
  reviewNumber: number | null;
  reviewUrl: string | null;
  reviewState: 'draft' | 'open' | 'merged' | 'closed' | 'unknown';
  reviewStateLabel: string | null;
  reviewSyncedAt: string | Date | null;
  atlasExecutionStatus: 'idle' | 'queued' | 'running' | 'succeeded' | 'failed';
  atlasExecutionLog: string | null;
  atlasExecutionStartedAt: string | Date | null;
  atlasExecutionFinishedAt: string | Date | null;
  errorMessage: string | null;
}

export async function markDatabaseRepairPlanApplied(
  projectId: string,
  databaseId: string
): Promise<DatabaseSchemaRepairPlan> {
  const response = await fetch(
    `/api/projects/${projectId}/databases/${databaseId}/schema/repair-plan/mark-applied`,
    {
      method: 'POST',
    }
  );

  const payload = await parseJsonResponse<{ plan: DatabaseSchemaRepairPlan }>(response);

  return payload.plan;
}

export async function createDatabaseRepairPlan(
  projectId: string,
  databaseId: string
): Promise<DatabaseSchemaRepairPlan> {
  const response = await fetch(
    `/api/projects/${projectId}/databases/${databaseId}/schema/repair-plan`,
    {
      method: 'POST',
    }
  );

  const payload = await parseJsonResponse<{ plan: DatabaseSchemaRepairPlan }>(response);

  return payload.plan;
}

export async function discardDatabaseRepairPlan(
  projectId: string,
  databaseId: string
): Promise<DatabaseSchemaRepairPlan> {
  const response = await fetch(
    `/api/projects/${projectId}/databases/${databaseId}/schema/repair-plan/discard`,
    {
      method: 'POST',
    }
  );

  const payload = await parseJsonResponse<{ plan: DatabaseSchemaRepairPlan }>(response);

  return payload.plan;
}

export async function createDatabaseRepairReviewRequest(
  projectId: string,
  databaseId: string
): Promise<DatabaseSchemaRepairPlan> {
  const response = await fetch(
    `/api/projects/${projectId}/databases/${databaseId}/schema/repair-plan/review-request`,
    {
      method: 'POST',
    }
  );

  const payload = await parseJsonResponse<{ plan: DatabaseSchemaRepairPlan }>(response);

  return payload.plan;
}

export async function syncDatabaseRepairReviewRequest(
  projectId: string,
  databaseId: string
): Promise<DatabaseSchemaRepairPlan> {
  const response = await fetch(
    `/api/projects/${projectId}/databases/${databaseId}/schema/repair-plan/review-request/sync`,
    {
      method: 'POST',
    }
  );

  const payload = await parseJsonResponse<{ plan: DatabaseSchemaRepairPlan }>(response);
  return payload.plan;
}

export async function runDatabaseRepairAtlas(
  projectId: string,
  databaseId: string
): Promise<{ id: string; status: 'queued' | 'running' | 'succeeded' | 'failed' }> {
  const response = await fetch(
    `/api/projects/${projectId}/databases/${databaseId}/schema/repair-plan/run-atlas`,
    {
      method: 'POST',
    }
  );

  const payload = await parseJsonResponse<{
    run: { id: string; status: 'queued' | 'running' | 'succeeded' | 'failed' };
  }>(response);
  return payload.run;
}

export async function fetchProjectEnvironments<T>(projectId: string): Promise<T> {
  const response = await fetch(`/api/projects/${projectId}/environments`);
  return parseJsonResponse<T>(response);
}

export async function createPreviewEnvironment(
  input: CreatePreviewEnvironmentInput
): Promise<PreviewEnvironmentRecord> {
  const response = await fetch(`/api/projects/${input.projectId}/preview-environments`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      branch: input.branch,
      prNumber: input.prNumber,
      ttlHours: input.ttlHours,
      databaseStrategy: input.databaseStrategy,
    }),
  });

  return parseJsonResponse<PreviewEnvironmentRecord>(response);
}

export async function deletePreviewEnvironment(
  projectId: string,
  environmentId: string
): Promise<void> {
  const response = await fetch(`/api/projects/${projectId}/preview-environments/${environmentId}`, {
    method: 'DELETE',
  });

  await parseJsonResponse<{ success: boolean }>(response);
}

export async function cleanupPreviewEnvironments(projectId: string): Promise<{
  deletedIds: string[];
  skipped: Array<{ id: string; reason: string }>;
}> {
  const response = await fetch(`/api/projects/${projectId}/preview-environments/cleanup`, {
    method: 'POST',
  });

  return parseJsonResponse<{
    deletedIds: string[];
    skipped: Array<{ id: string; reason: string }>;
  }>(response);
}

export async function updateEnvironmentStrategy(
  input: UpdateEnvironmentStrategyInput
): Promise<void> {
  const response = await fetch(
    `/api/projects/${input.projectId}/environments/${input.environmentId}`,
    {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        deploymentStrategy: input.deploymentStrategy,
      }),
    }
  );

  await parseJsonResponse<{ success: boolean }>(response);
}

export async function setEnvironmentRuntimeState(input: {
  projectId: string;
  environmentId: string;
  action: 'sleep' | 'wake';
}): Promise<EnvironmentRuntimeState> {
  const response = await fetch(
    `/api/projects/${input.projectId}/environments/${input.environmentId}/runtime`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        action: input.action,
      }),
    }
  );

  const payload = await parseJsonResponse<{ runtimeState: EnvironmentRuntimeState }>(response);
  return payload.runtimeState;
}

export async function updateDeliveryControl(input: {
  projectId: string;
  routingRules: DeliveryRoutingRuleInput[];
  promotionFlows: PromotionFlowInput[];
}): Promise<void> {
  const response = await fetch(`/api/projects/${input.projectId}/delivery-control`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      routingRules: input.routingRules,
      promotionFlows: input.promotionFlows,
    }),
  });

  await parseJsonResponse<{ success: boolean }>(response);
}
