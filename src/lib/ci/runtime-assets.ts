import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

export const ciRuntimeVersion = 'v1' as const;
export const ciRuntimeAssetNames = [
  'build-run.sh',
  'changes.mjs',
  'delivery-artifacts.sh',
  'workload-identity.sh',
] as const;

export type CiRuntimeAssetName = (typeof ciRuntimeAssetNames)[number];
export const ciRuntimeAssetDigests: Record<CiRuntimeAssetName, string> = {
  'build-run.sh': '618a5dfd13ad94ad66c22861929e8e177ad91f777c9b95e6cf9f5eb277901d7d',
  'changes.mjs': 'cda4e87914de1e3f24497376e64538e175a447cb4feafffc2a8859acd368bfc6',
  'delivery-artifacts.sh': '409891525ff7f1f029ee7c6e402c312db778a74d53e15bed8cbbf770437e1659',
  'workload-identity.sh': 'ca3db3a2d115d27a2497e007e3c3caf1cd707d5d072f2b266f71a38b64c6bd2b',
};

function templatesRoot(): string {
  return join(process.cwd(), 'templates', 'ci');
}

export function isCiRuntimeAssetName(value: string): value is CiRuntimeAssetName {
  return ciRuntimeAssetNames.includes(value as CiRuntimeAssetName);
}

export async function readCiRuntimeAsset(asset: CiRuntimeAssetName): Promise<string> {
  return readFileSync(join(templatesRoot(), 'runtime', ciRuntimeVersion, asset), 'utf8');
}

export async function readGitLabCiComponent(): Promise<string> {
  return readGitLabCiComponentSync();
}

export function readGitLabCiComponentSync(): string {
  return readFileSync(join(templatesRoot(), `gitlab-component-${ciRuntimeVersion}.yml`), 'utf8');
}

export async function getGitLabCiComponentIntegrity(): Promise<string> {
  const content = await readGitLabCiComponent();
  return `sha256-${createHash('sha256').update(content, 'utf8').digest('base64')}`;
}

export function getGitLabCiComponentIntegritySync(): string {
  return `sha256-${createHash('sha256')
    .update(readGitLabCiComponentSync(), 'utf8')
    .digest('base64')}`;
}

function requiredProductionValue(name: string, developmentValue: string): string {
  const value = process.env[name]?.trim();
  if (value) return value;
  if (process.env.NODE_ENV !== 'production') return developmentValue;
  throw new Error(`${name} is required in production`);
}

function normalizeControlPlaneOrigin(value: string): string {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error('NEXTAUTH_URL must be an absolute HTTP(S) origin');
  }

  if (
    (url.protocol !== 'https:' && url.protocol !== 'http:') ||
    url.username ||
    url.password ||
    (url.pathname !== '/' && url.pathname !== '') ||
    url.search ||
    url.hash
  ) {
    throw new Error(
      'NEXTAUTH_URL must be an absolute HTTP(S) origin without credentials or a path'
    );
  }
  if (process.env.NODE_ENV === 'production' && url.protocol !== 'https:') {
    throw new Error('NEXTAUTH_URL must use HTTPS in production');
  }

  return url.origin;
}

export function getCiRuntimeDescriptor(): {
  baseUrl: string;
  githubRepository: string;
  githubRevision: string;
  version: typeof ciRuntimeVersion;
} {
  const baseUrl = normalizeControlPlaneOrigin(
    requiredProductionValue('NEXTAUTH_URL', 'http://localhost:3001')
  );
  const githubRepository = requiredProductionValue('JUANIE_SOURCE_REPOSITORY', '997899594/Juanie');
  const githubRevision = requiredProductionValue('JUANIE_SOURCE_REVISION', 'main');

  if (!/^[^/\s]+\/[^/\s]+$/u.test(githubRepository)) {
    throw new Error('JUANIE_SOURCE_REPOSITORY must be a GitHub owner/repository pair');
  }
  if (process.env.NODE_ENV === 'production' && !/^[a-f0-9]{40}$/u.test(githubRevision)) {
    throw new Error('JUANIE_SOURCE_REVISION must be an immutable 40-character commit SHA');
  }

  return { baseUrl, githubRepository, githubRevision, version: ciRuntimeVersion };
}
