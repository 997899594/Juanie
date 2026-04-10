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
}

export interface UpdateEnvironmentStrategyInput {
  projectId: string;
  environmentId: string;
  deploymentStrategy: 'rolling' | 'controlled' | 'canary' | 'blue_green';
}

export interface CreatePreviewEnvironmentInput {
  projectId: string;
  branch?: string;
  prNumber?: number;
  ttlHours?: number;
  databaseStrategy?: 'inherit' | 'isolated_clone';
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
