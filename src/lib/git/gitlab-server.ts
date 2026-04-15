import type { GitProviderType } from '@/lib/db/schema';

export const DEFAULT_GITLAB_SERVER_URL = 'https://gitlab.com';

export function normalizeGitLabServerUrl(serverUrl?: string | null): string {
  const raw = serverUrl?.trim() || DEFAULT_GITLAB_SERVER_URL;
  const normalized = new URL(raw);
  normalized.pathname = '';
  normalized.search = '';
  normalized.hash = '';
  return normalized.toString().replace(/\/$/, '');
}

export function resolveGitLabProviderType(serverUrl?: string | null): GitProviderType {
  return normalizeGitLabServerUrl(serverUrl) === DEFAULT_GITLAB_SERVER_URL
    ? 'gitlab'
    : 'gitlab-self-hosted';
}

export function resolveGitLabServerUrlFromEnv(): string {
  return normalizeGitLabServerUrl(process.env.GITLAB_URL);
}
