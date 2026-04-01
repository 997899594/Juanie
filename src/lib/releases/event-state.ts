export function buildReleaseEventStateKey(
  release?: {
    id: string;
    status: string;
    sourceCommitSha: string | null;
    updatedAt: string | Date;
    recap?: {
      generatedAt?: string | null;
    } | null;
  } | null
): string | null {
  if (!release) {
    return null;
  }

  return [
    release.id,
    release.status,
    release.sourceCommitSha ?? '',
    release.updatedAt,
    release.recap?.generatedAt ?? '',
  ].join(':');
}
