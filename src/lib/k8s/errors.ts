export function isK8sNotFoundError(error: unknown): boolean {
  return getK8sStatusCode(error) === 404;
}

export function isK8sConflictError(error: unknown): boolean {
  return getK8sStatusCode(error) === 409;
}

function getK8sStatusCode(error: unknown): number | undefined {
  if (!error || typeof error !== 'object') {
    return undefined;
  }

  const candidate = error as { code?: number; statusCode?: number };
  return candidate.code ?? candidate.statusCode;
}
