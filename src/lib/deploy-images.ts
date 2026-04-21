const PUBLIC_IMAGE_REGISTRY = 'ghcr.io';

interface DeployImageSource {
  configJson?: unknown;
  repositoryFullName?: string | null;
}

function normalizeRepositoryPath(value: string): string {
  return value
    .trim()
    .replace(/^\/+|\/+$/g, '')
    .toLowerCase();
}

function buildTaggedImageReference(imageRepository: string, commitSha: string): string {
  return `${imageRepository}:sha-${commitSha.trim()}`;
}

export function buildDeployImageRepository(repoFullName: string): string {
  return `${PUBLIC_IMAGE_REGISTRY}/${normalizeRepositoryPath(repoFullName)}`;
}

export function buildDeployImageReference(repoFullName: string, commitSha: string): string {
  return buildTaggedImageReference(buildDeployImageRepository(repoFullName), commitSha);
}

export function resolveDeployImageRepository(input: DeployImageSource): string | null {
  const config =
    input.configJson && typeof input.configJson === 'object'
      ? (input.configJson as Record<string, unknown>)
      : null;
  const configuredImageName = typeof config?.imageName === 'string' ? config.imageName.trim() : '';

  if (configuredImageName) {
    return configuredImageName;
  }

  if (!input.repositoryFullName) {
    return null;
  }

  return buildDeployImageRepository(input.repositoryFullName);
}

export function resolveDeployImageReference(
  input: DeployImageSource,
  commitSha: string | null | undefined
): string | null {
  if (!commitSha) {
    return null;
  }

  const imageRepository = resolveDeployImageRepository(input);
  if (!imageRepository) {
    return null;
  }

  return buildTaggedImageReference(imageRepository, commitSha);
}
