import { parse } from 'yaml';
import { getCiRuntimeDescriptor, getGitLabCiComponentIntegritySync } from '@/lib/ci/runtime-assets';

const maxBootstrapBytes = 256 * 1024;

type GitLabInclude = {
  remote?: unknown;
  integrity?: unknown;
  inputs?: unknown;
};

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

export interface TrustedGitLabBootstrap {
  componentUrl: string;
  componentIntegrity: string;
  baseUrl: string;
}

export function getTrustedGitLabBootstrap(): TrustedGitLabBootstrap {
  const runtime = getCiRuntimeDescriptor();
  return {
    componentUrl: `${runtime.baseUrl}/api/ci/components/gitlab/${runtime.version}`,
    componentIntegrity: getGitLabCiComponentIntegritySync(),
    baseUrl: runtime.baseUrl,
  };
}

export function assertTrustedGitLabBootstrap(
  content: string,
  trusted: TrustedGitLabBootstrap = getTrustedGitLabBootstrap()
): void {
  if (Buffer.byteLength(content, 'utf8') > maxBootstrapBytes) {
    throw new Error('GitLab CI bootstrap exceeds the maximum trusted size');
  }

  const document = asRecord(parse(content, { maxAliasCount: 20 }));
  if (!document) throw new Error('GitLab CI bootstrap must be a YAML mapping');

  const includes = Array.isArray(document.include)
    ? document.include
    : document.include === undefined
      ? []
      : [document.include];
  const managedIncludes = includes.filter((entry) => {
    const include = asRecord(entry) as GitLabInclude | null;
    return (
      typeof include?.remote === 'string' && include.remote.includes('/api/ci/components/gitlab/')
    );
  });

  if (managedIncludes.length !== 1) {
    throw new Error('GitLab CI bootstrap must contain exactly one Juanie Component include');
  }

  const include = asRecord(managedIncludes[0]) as GitLabInclude;
  const inputs = asRecord(include.inputs);
  if (
    include.remote !== trusted.componentUrl ||
    include.integrity !== trusted.componentIntegrity ||
    inputs?.juanie_base_url !== trusted.baseUrl
  ) {
    throw new Error('GitLab CI bootstrap does not match the deployed Juanie runtime');
  }
}
