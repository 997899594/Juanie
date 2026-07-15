import { isJuanieCiToken, verifyJuanieCiToken } from '@/lib/releases/ci-identity';

export class CiAccessError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CiAccessError';
  }
}

export function isCiAccessError(error: unknown): error is CiAccessError {
  return error instanceof CiAccessError;
}

export function requireBearerToken(authHeader: string | null): string {
  if (!authHeader?.startsWith('Bearer ')) {
    throw new CiAccessError('Missing CI workload bearer token');
  }
  const token = authHeader.slice('Bearer '.length).trim();
  if (!token) throw new CiAccessError('Missing CI workload bearer token');
  return token;
}

export async function verifyRepositoryAccess(
  repository: string,
  authHeader: string | null,
  releaseScope?: {
    ref?: string | null;
    sha?: string | null;
    externalRunId?: string | null;
  }
): Promise<void> {
  const token = requireBearerToken(authHeader);
  if (!isJuanieCiToken(token)) {
    throw new CiAccessError('CI workload identity is required');
  }
  try {
    await verifyJuanieCiToken(token, { repository, ...releaseScope });
  } catch {
    throw new CiAccessError('CI workload identity does not match this request');
  }
}
