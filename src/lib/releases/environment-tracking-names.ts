function slugifyBranchSegment(value: string): string {
  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-');

  return normalized.length > 0 ? normalized : 'environment';
}

export function buildEnvironmentTrackingBranchName(environmentName: string): string {
  return `juanie-env-${slugifyBranchSegment(environmentName)}`;
}

export function buildReleaseEnvironmentTagName(input: {
  environmentName: string;
  createdAt: Date | string;
  sourceCommitSha: string | null;
}): string | null {
  if (!input.sourceCommitSha) {
    return null;
  }

  const createdAt = input.createdAt instanceof Date ? input.createdAt : new Date(input.createdAt);

  return `juanie-${slugifyBranchSegment(input.environmentName)}-${createdAt
    .toISOString()
    .slice(0, 10)
    .replace(/-/g, '.')}-${input.sourceCommitSha.slice(0, 7)}`;
}
