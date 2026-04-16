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

export async function fetchProjectSchemaCenter<T>(
  projectId: string,
  envId?: string | null
): Promise<T> {
  const params = new URLSearchParams();
  if (envId) {
    params.set('env', envId);
  }

  const query = params.toString();
  const response = await fetch(`/api/projects/${projectId}/schema${query ? `?${query}` : ''}`);
  return parseJsonResponse<T>(response);
}
