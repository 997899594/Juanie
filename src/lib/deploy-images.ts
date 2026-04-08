const PUBLIC_IMAGE_REGISTRY = 'ghcr.io';

function normalizeRepositoryPath(value: string): string {
  return value
    .trim()
    .replace(/^\/+|\/+$/g, '')
    .toLowerCase();
}

export function buildDeployImageRepository(repoFullName: string): string {
  return `${PUBLIC_IMAGE_REGISTRY}/${normalizeRepositoryPath(repoFullName)}`;
}

export function buildDeployImageReference(repoFullName: string, commitSha: string): string {
  return `${buildDeployImageRepository(repoFullName)}:sha-${commitSha.trim()}`;
}
