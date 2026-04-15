import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { integrationIdentities, repositories } from '@/lib/db/schema';
import { normalizeGitLabServerUrl } from '@/lib/git/gitlab-server';

export function resolveRepositoryVerificationTarget(
  repository: string,
  provider: 'github' | 'gitlab' | 'gitlab-self-hosted',
  repo: {
    webUrl: string | null;
    cloneUrl: string | null;
    serverUrl?: string | null;
  }
): { url: string; headers: Record<string, string> } {
  if (provider === 'github') {
    return {
      url: `https://api.github.com/repos/${repository}`,
      headers: {
        Accept: 'application/vnd.github+json',
      },
    };
  }

  let baseUrl: string | null = null;

  if (provider === 'gitlab') {
    baseUrl = 'https://gitlab.com';
  } else if (repo.serverUrl) {
    baseUrl = normalizeGitLabServerUrl(repo.serverUrl);
  }

  if (!baseUrl) {
    throw new Error('Unable to resolve Git provider URL for repository');
  }

  return {
    url: `${baseUrl}/api/v4/projects/${encodeURIComponent(repository)}`,
    headers: {},
  };
}

export function getRepositoryAccessDeniedMessage(
  provider: 'github' | 'gitlab' | 'gitlab-self-hosted'
): string {
  return provider === 'github'
    ? 'Token does not have access to this repository'
    : 'Token does not have access to this GitLab repository';
}

export function requireBearerToken(authHeader: string | null): string {
  if (!authHeader?.startsWith('Bearer ')) {
    throw new Error('Missing bearer token');
  }

  return authHeader.substring(7);
}

export async function verifyRepositoryAccess(repository: string, authHeader: string | null) {
  const token = requireBearerToken(authHeader);
  const repo = await db.query.repositories.findFirst({
    where: eq(repositories.fullName, repository),
  });

  if (!repo) {
    throw new Error(`Repository ${repository} not found in Juanie`);
  }

  const identity = await db.query.integrationIdentities.findFirst({
    where: eq(integrationIdentities.id, repo.providerId),
  });

  if (!identity) {
    throw new Error('Repository integration identity not found');
  }

  const target = resolveRepositoryVerificationTarget(repository, identity.provider, {
    webUrl: repo.webUrl,
    cloneUrl: repo.cloneUrl,
    serverUrl: identity.serverUrl,
  });

  const repoRes = await fetch(target.url, {
    headers: {
      Authorization: `Bearer ${token}`,
      ...target.headers,
      ...(identity.provider === 'github'
        ? {}
        : {
            'PRIVATE-TOKEN': token,
            'JOB-TOKEN': token,
          }),
    },
  });

  if (repoRes.ok) {
    return;
  }

  throw new Error(getRepositoryAccessDeniedMessage(identity.provider));
}
