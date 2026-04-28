export type TimedJSONResult<T> =
  | {
      ok: true;
      data: T;
    }
  | {
      ok: false;
      error: string;
    };

export async function fetchJSONWithTimeout<T>(
  url: string,
  options: RequestInit & { timeoutMs?: number } = {}
): Promise<TimedJSONResult<T>> {
  const { timeoutMs = 3500, ...requestOptions } = options;
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      ...requestOptions,
      signal: controller.signal,
    });
    const data = (await response.json().catch(() => null)) as T | { error?: string } | null;

    if (!response.ok) {
      const error =
        data && typeof data === 'object' && 'error' in data && typeof data.error === 'string'
          ? data.error
          : '请求失败';
      return { ok: false, error };
    }

    return { ok: true, data: data as T };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof DOMException && error.name === 'AbortError' ? '请求超时' : '请求失败',
    };
  } finally {
    window.clearTimeout(timer);
  }
}
