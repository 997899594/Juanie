import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { getPublicOrigin } from '@/lib/runtime/public-origin';

export const ciRuntimeVersion = 'v1' as const;
export const ciRuntimeAssetNames = [
  'build-run.sh',
  'delivery-artifacts.sh',
  'workload-identity.sh',
] as const;

export type CiRuntimeAssetName = (typeof ciRuntimeAssetNames)[number];
export const ciRuntimeAssetDigests: Record<CiRuntimeAssetName, string> = {
  'build-run.sh': 'b9eb15815d7aa48cbdeb3c1cd220eebbb0b593aed8d86491c210a68adb269f04',
  'delivery-artifacts.sh': '7f7e8b61d62c10a152314c7e0d4058839b79e60dc85ff3dd00a6e13c66929154',
  'workload-identity.sh': '1f68413d297325e8585db843848df88d71461266a7e2e0c5fe8c301af8356a48',
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

function requiredRuntimeValue(name: string): string {
  const value = process.env[name]?.trim();
  if (value) return value;
  throw new Error(`${name} is required`);
}

export function getCiRuntimeDescriptor(): {
  baseUrl: string;
  githubRepository: string;
  githubRevision: string;
  version: typeof ciRuntimeVersion;
} {
  const baseUrl = getPublicOrigin();
  const githubRepository = requiredRuntimeValue('JUANIE_SOURCE_REPOSITORY');
  const githubRevision = requiredRuntimeValue('JUANIE_SOURCE_REVISION');

  if (!/^[^/\s]+\/[^/\s]+$/u.test(githubRepository)) {
    throw new Error('JUANIE_SOURCE_REPOSITORY must be a GitHub owner/repository pair');
  }
  if (process.env.NODE_ENV === 'production' && !/^[a-f0-9]{40}$/u.test(githubRevision)) {
    throw new Error('JUANIE_SOURCE_REVISION must be an immutable 40-character commit SHA');
  }

  return { baseUrl, githubRepository, githubRevision, version: ciRuntimeVersion };
}
