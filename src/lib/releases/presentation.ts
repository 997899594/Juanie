import { type EnvironmentKindLike, isPreviewEnvironment } from '@/lib/environments/model';
import { extractBranchFromRef, extractPrNumberFromRef } from '@/lib/environments/preview';

export interface ReleasePresentationLike {
  summary?: string | null;
  sourceRef?: string | null;
  sourceCommitSha?: string | null;
  environment?: EnvironmentKindLike | null;
}

function extractTagFromRef(ref?: string | null): string | null {
  if (!ref?.startsWith('refs/tags/')) {
    return null;
  }

  return ref.slice('refs/tags/'.length);
}

function shortSha(value?: string | null): string | null {
  return value ? value.slice(0, 7) : null;
}

export function buildDefaultReleaseSummary(input: {
  sourceRef?: string | null;
  sourceCommitSha?: string | null;
  environment?: EnvironmentKindLike | null;
}): string {
  const prNumber = input.sourceRef ? extractPrNumberFromRef(input.sourceRef) : null;
  const branch = input.sourceRef ? extractBranchFromRef(input.sourceRef) : null;
  const tag = extractTagFromRef(input.sourceRef);
  const sha = shortSha(input.sourceCommitSha);
  const isPreview = input.environment ? isPreviewEnvironment(input.environment) : false;

  let label = '发布';

  if (prNumber !== null) {
    label = `PR #${prNumber}${isPreview ? ' 预览' : ''}`;
  } else if (branch) {
    label = isPreview ? `${branch} 预览` : `${branch} 发布`;
  } else if (tag) {
    label = `标签 ${tag}`;
  }

  return sha ? `${label} · ${sha}` : label;
}

export function getReleaseDisplayTitle(release: ReleasePresentationLike): string {
  if (release.summary && release.summary.trim().length > 0) {
    return release.summary;
  }

  return buildDefaultReleaseSummary({
    sourceRef: release.sourceRef,
    sourceCommitSha: release.sourceCommitSha,
    environment: release.environment,
  });
}
