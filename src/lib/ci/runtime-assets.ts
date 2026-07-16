import { readFileSync } from 'node:fs';
import { join } from 'node:path';

export const ciRuntimeVersion = 'v1' as const;
export const ciRuntimeAssetNames = [
  'build-run.sh',
  'delivery-artifacts.sh',
  'workload-identity.sh',
] as const;

export type CiRuntimeAssetName = (typeof ciRuntimeAssetNames)[number];
export const ciRuntimeAssetDigests: Record<CiRuntimeAssetName, string> = {
  'build-run.sh': 'a0acf8264fb2a24f551c9a684393032d082a0334ed59cebf6edbc698bf1ef35a',
  'delivery-artifacts.sh': '7f7e8b61d62c10a152314c7e0d4058839b79e60dc85ff3dd00a6e13c66929154',
  'workload-identity.sh': 'c03714358bdb8b013e86f3a8448eea838ea78d1a8f8b5ac9100524a2c0ce7112',
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
