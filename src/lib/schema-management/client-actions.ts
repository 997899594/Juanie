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

export async function fetchProjectSchemaCenter<T>(projectId: string): Promise<T> {
  const response = await fetch(`/api/projects/${projectId}/schema`);
  return parseJsonResponse<T>(response);
}
