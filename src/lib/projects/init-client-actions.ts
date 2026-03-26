'use client';

export async function retryProjectInitialization(
  projectId: string
): Promise<{ ok: true; overview: unknown } | { ok: false; error: string }> {
  try {
    const response = await fetch(`/api/projects/${projectId}/init/retry`, {
      method: 'POST',
    });

    const data = await response.json();

    if (!response.ok) {
      return {
        ok: false,
        error: data.error ?? '重新执行初始化失败',
      };
    }

    return {
      ok: true,
      overview: data.overview,
    };
  } catch {
    return {
      ok: false,
      error: '重新执行初始化失败',
    };
  }
}
