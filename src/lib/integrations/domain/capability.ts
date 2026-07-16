import type { Capability } from './models';

type Provider = 'github' | 'gitlab' | 'gitlab-self-hosted';

const sortCapabilities = (capabilities: Iterable<Capability>): Capability[] =>
  Array.from(new Set(capabilities)).sort((a, b) => a.localeCompare(b)) as Capability[];

export const resolveGitHubCapabilities = (scopes: string[]): Capability[] => {
  const normalized = new Set(scopes.map((scope) => scope.trim()).filter(Boolean));
  const capabilities: Capability[] = [];

  // repo scope includes read and write access
  if (normalized.has('repo') || normalized.has('public_repo')) {
    capabilities.push('read_repo', 'write_repo', 'manage_webhook');
  }

  // workflow scope for GitHub Actions
  if (normalized.has('workflow')) {
    capabilities.push('write_workflow');
  }

  return sortCapabilities(capabilities);
};

export const resolveGitLabCapabilities = (scopes: string[]): Capability[] => {
  const normalized = new Set(scopes.map((scope) => scope.trim()).filter(Boolean));
  const capabilities: Capability[] = [];

  if (normalized.has('api') || normalized.has('read_api') || normalized.has('read_repository')) {
    capabilities.push('read_repo');
  }

  if (normalized.has('api') || normalized.has('write_repository')) {
    capabilities.push('write_repo');
  }

  if (normalized.has('api') || normalized.has('write_repository')) {
    capabilities.push('write_workflow');
  }

  if (normalized.has('api')) {
    capabilities.push('manage_webhook');
  }

  return sortCapabilities(capabilities);
};

export function resolveProviderCapabilities(
  provider: Provider,
  scopeRaw?: string | null
): Capability[] {
  const scopes = (scopeRaw ?? '')
    .split(/[\s,]+/u)
    .map((scope) => scope.trim())
    .filter(Boolean);
  return provider === 'github'
    ? resolveGitHubCapabilities(scopes)
    : resolveGitLabCapabilities(scopes);
}
