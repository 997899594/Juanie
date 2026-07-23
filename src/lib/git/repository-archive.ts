import type { GitProviderType } from '@/lib/db/schema';

const archiveContentTypes = new Set([
  'application/gzip',
  'application/octet-stream',
  'application/x-gzip',
]);

export type RepositoryArchiveErrorCode =
  | 'empty_body'
  | 'invalid_content_type'
  | 'invalid_redirect'
  | 'transport_failure'
  | 'upstream_rejected';

export interface RepositoryArchive {
  body: ReadableStream<Uint8Array>;
  contentLength: number | null;
  contentType: string;
}

export class RepositoryArchiveError extends Error {
  constructor(
    message: string,
    readonly provider: GitProviderType,
    readonly code: RepositoryArchiveErrorCode,
    readonly upstreamStatus: number | null = null,
    options?: ErrorOptions
  ) {
    super(message, options);
    this.name = 'RepositoryArchiveError';
  }
}

async function readErrorMessage(response: Response): Promise<string> {
  const body = (await response.text()).trim();
  if (!body) return response.statusText || 'empty response';

  try {
    const payload: unknown = JSON.parse(body);
    if (typeof payload === 'object' && payload !== null && 'message' in payload) {
      const message = payload.message;
      if (typeof message === 'string' && message.trim()) return message.trim();
    }
  } catch {
    // Provider error bodies are not guaranteed to be JSON.
  }

  return body.slice(0, 500);
}

export async function validateRepositoryArchiveResponse(
  provider: GitProviderType,
  response: Response
): Promise<RepositoryArchive> {
  if (!response.ok) {
    const message = await readErrorMessage(response);
    throw new RepositoryArchiveError(
      `${provider} archive request returned HTTP ${response.status}: ${message}`,
      provider,
      'upstream_rejected',
      response.status
    );
  }

  const contentType = response.headers.get('content-type')?.split(';', 1)[0]?.trim().toLowerCase();
  if (!contentType || !archiveContentTypes.has(contentType)) {
    throw new RepositoryArchiveError(
      `${provider} archive response has unsupported content type: ${contentType || 'missing'}`,
      provider,
      'invalid_content_type',
      response.status
    );
  }
  if (!response.body) {
    throw new RepositoryArchiveError(
      `${provider} archive response has no body`,
      provider,
      'empty_body',
      response.status
    );
  }

  const rawContentLength = response.headers.get('content-length');
  const parsedContentLength = rawContentLength ? Number(rawContentLength) : Number.NaN;
  const contentLength =
    Number.isSafeInteger(parsedContentLength) && parsedContentLength > 0
      ? parsedContentLength
      : null;

  return {
    body: response.body,
    contentLength,
    contentType,
  };
}

export function repositoryArchiveTransportError(
  provider: GitProviderType,
  error: unknown
): RepositoryArchiveError {
  if (error instanceof RepositoryArchiveError) return error;

  return new RepositoryArchiveError(
    `${provider} archive transport failed`,
    provider,
    'transport_failure',
    null,
    { cause: error }
  );
}
