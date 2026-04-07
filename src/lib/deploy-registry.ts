const DEFAULT_DEPLOY_REGISTRY = 'ghcr.io';
const DEFAULT_DEPLOY_IMAGE_PULL_SECRET_NAME = 'ghcr-pull-secret';

function normalizeRegistryHost(value: string): string {
  return value.replace(/^https?:\/\//, '').replace(/\/+$/, '');
}

function normalizeRepositoryPath(value: string): string {
  return value
    .trim()
    .replace(/^\/+|\/+$/g, '')
    .toLowerCase();
}

export function getDeployRegistryHost(): string {
  const configured = process.env.DEPLOY_REGISTRY?.trim();
  return normalizeRegistryHost(configured || DEFAULT_DEPLOY_REGISTRY);
}

export function getDeployRegistryPullSecretName(): string {
  return (
    process.env.DEPLOY_REGISTRY_PULL_SECRET_NAME?.trim() || DEFAULT_DEPLOY_IMAGE_PULL_SECRET_NAME
  );
}

export function getDeployRegistryCredentials(): {
  username: string;
  password: string;
} | null {
  const username = process.env.DEPLOY_REGISTRY_USERNAME?.trim();
  const password = process.env.DEPLOY_REGISTRY_PASSWORD?.trim();

  if (!username || !password) {
    return null;
  }

  return { username, password };
}

export function buildDeployImageRepository(repoFullName: string): string {
  return `${getDeployRegistryHost()}/${normalizeRepositoryPath(repoFullName)}`;
}

export function buildDeployImageReference(repoFullName: string, commitSha: string): string {
  return `${buildDeployImageRepository(repoFullName)}:sha-${commitSha.trim()}`;
}

export function usesDeployRegistryImage(imageUrl: string): boolean {
  const match = imageUrl.match(/^(?:https?:\/\/)?([^/]+)\//);
  return match?.[1] === getDeployRegistryHost();
}
