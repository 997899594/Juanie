import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { integrationIdentities, repositories } from '@/lib/db/schema';

export function resolveRepositoryVerificationTarget(
  repository: string,
  provider: 'github' | 'gitlab' | 'gitlab-self-hosted',
  repo: {
    webUrl: string | null;
    cloneUrl: string | null;
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

  const baseUrl =
    provider === 'gitlab'
      ? 'https://gitlab.com'
      : repo.webUrl
        ? new URL(repo.webUrl).origin
        : repo.cloneUrl
          ? new URL(repo.cloneUrl).origin
          : null;

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

export async function verifyRepositoryAccess(repository: string, authHeader: string | null) {
  if (!authHeader?.startsWith('Bearer ')) {
    return;
  }

  const token = authHeader.substring(7);
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
