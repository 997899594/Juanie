import { randomUUID } from 'node:crypto';
import { importPKCS8, SignJWT } from 'jose';
import { getCiRuntimeDescriptor } from '@/lib/ci/runtime-assets';
import type { GitProviderType } from '@/lib/db/schema';

const GITHUB_API = 'https://api.github.com';
const WORKFLOW_ID = 'application-delivery.yml';

export interface ApplicationDeliveryInput {
  provider: GitProviderType;
  repository: string;
  sourceRef: string;
  sourceCommitSha: string;
  beforeCommitSha?: string | null;
  deliveryId?: string;
  forceFullBuild?: boolean;
}

interface GitHubInstallationTokenResponse {
  token?: string;
  expires_at?: string;
}

function requiredPlatformSecret(name: string): string {
  const value = process.env[name]?.trim();
  if (value) return value;
  throw new Error(`${name} is required to dispatch platform-owned application delivery`);
}

function readPrivateKey(): string {
  return requiredPlatformSecret('JUANIE_GITHUB_APP_PRIVATE_KEY').replace(/\\n/g, '\n');
}

async function createGitHubAppJwt(): Promise<string> {
  const appId = requiredPlatformSecret('JUANIE_GITHUB_APP_ID');
  const key = await importPKCS8(readPrivateKey(), 'RS256');
  const now = Math.floor(Date.now() / 1000);

  return new SignJWT({})
    .setProtectedHeader({ alg: 'RS256' })
    .setIssuer(appId)
    .setIssuedAt(now - 60)
    .setExpirationTime(now + 9 * 60)
    .sign(key);
}

async function githubRequest<T>(
  path: string,
  token: string,
  options: { method?: string; body?: unknown } = {}
): Promise<T> {
  const response = await fetch(`${GITHUB_API}${path}`, {
    method: options.method ?? 'GET',
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      'X-GitHub-Api-Version': '2022-11-28',
    },
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });

  if (response.status === 204) return undefined as T;
  const payload = (await response.json().catch(() => null)) as (T & { message?: string }) | null;
  if (!response.ok) {
    throw new Error(payload?.message ?? `GitHub API request failed with ${response.status}`);
  }
  return payload as T;
}

async function getPlatformInstallationToken(repository: string): Promise<string> {
  const appJwt = await createGitHubAppJwt();
  const configuredInstallationId = process.env.JUANIE_GITHUB_APP_INSTALLATION_ID?.trim();
  const installationId = configuredInstallationId
    ? Number(configuredInstallationId)
    : (await githubRequest<{ id: number }>(`/repos/${repository}/installation`, appJwt)).id;

  if (!Number.isSafeInteger(installationId) || installationId <= 0) {
    throw new Error('JUANIE_GITHUB_APP_INSTALLATION_ID must be a positive integer');
  }

  const response = await githubRequest<GitHubInstallationTokenResponse>(
    `/app/installations/${installationId}/access_tokens`,
    appJwt,
    {
      method: 'POST',
      body: {
        repositories: [repository.slice(repository.indexOf('/') + 1)],
        permissions: { actions: 'write', contents: 'read' },
      },
    }
  );
  if (!response.token) throw new Error('GitHub App did not return an installation token');
  return response.token;
}

export async function dispatchApplicationDelivery(
  input: ApplicationDeliveryInput
): Promise<{ deliveryId: string }> {
  const runtime = getCiRuntimeDescriptor();
  const workflowRef = process.env.JUANIE_DELIVERY_WORKFLOW_REF?.trim() || 'main';
  const deliveryId = input.deliveryId?.trim() || randomUUID();
  const token = await getPlatformInstallationToken(runtime.githubRepository);

  await githubRequest<void>(
    `/repos/${runtime.githubRepository}/actions/workflows/${WORKFLOW_ID}/dispatches`,
    token,
    {
      method: 'POST',
      body: {
        ref: workflowRef,
        inputs: {
          source_provider: input.provider,
          source_repository: input.repository,
          source_ref: input.sourceRef,
          source_sha: input.sourceCommitSha,
          before_sha: input.beforeCommitSha?.trim() || '',
          delivery_id: deliveryId,
          force_full_build: input.forceFullBuild ? 'true' : 'false',
        },
      },
    }
  );

  return { deliveryId };
}
