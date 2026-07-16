import { parse, stringify } from 'yaml';

export const legacyJuanieGitHubWorkflowPath = '.github/workflows/juanie-ci.yml';
export const legacyJuanieGitLabCiPath = '.gitlab-ci.yml';
const legacyJuanieGitLabComponentPath = '/api/ci/components/gitlab/';

export function isJuanieManagedGitLabCi(content: string | null | undefined): boolean {
  return content?.includes(legacyJuanieGitLabComponentPath) ?? false;
}

export function removeJuanieGitLabComponent(content: string): string | null {
  const document = parse(content) as Record<string, unknown> | null;
  if (!document || Array.isArray(document) || typeof document !== 'object') {
    throw new Error('Existing .gitlab-ci.yml must contain a YAML mapping');
  }
  const includes = Array.isArray(document.include)
    ? document.include
    : document.include
      ? [document.include]
      : [];
  const remainingIncludes = includes.filter(
    (entry) =>
      !(
        entry &&
        typeof entry === 'object' &&
        'remote' in entry &&
        typeof entry.remote === 'string' &&
        entry.remote.includes(legacyJuanieGitLabComponentPath)
      )
  );
  if (remainingIncludes.length === includes.length) return content;
  if (remainingIncludes.length > 0) document.include = remainingIncludes;
  else delete document.include;
  return Object.keys(document).length === 0 ? null : stringify(document, { lineWidth: 0 });
}

export function buildJuanieRepositoryCleanupPaths({
  provider,
  gitlabCiContent,
}: {
  provider: 'github' | 'gitlab' | 'gitlab-self-hosted';
  gitlabCiContent?: string | null;
}): string[] {
  if (provider === 'github') return [legacyJuanieGitHubWorkflowPath];
  if (gitlabCiContent && removeJuanieGitLabComponent(gitlabCiContent) === null) {
    return [legacyJuanieGitLabCiPath];
  }
  return [];
}
