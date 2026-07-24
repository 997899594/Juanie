import { createHash } from 'node:crypto';

export interface PromotionContent {
  sourceReleaseId: string;
  targetEnvironmentId: string;
  sourceCommitSha: string | null;
  migrationApprovalMode: 'independent_release_plan';
  artifacts: Array<{
    serviceId: string;
    image: string;
    digest: string;
    sbomUri: string | null;
    provenanceUri: string | null;
  }>;
}

function stableSerialize(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableSerialize).join(',')}]`;
  if (value && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>).sort(([left], [right]) =>
      left.localeCompare(right)
    );
    return `{${entries
      .map(([key, entryValue]) => `${JSON.stringify(key)}:${stableSerialize(entryValue)}`)
      .join(',')}}`;
  }
  return JSON.stringify(value);
}

export function normalizePromotionContent(content: PromotionContent): PromotionContent {
  return {
    ...content,
    artifacts: [...content.artifacts].sort((left, right) =>
      `${left.serviceId}:${left.digest}`.localeCompare(`${right.serviceId}:${right.digest}`)
    ),
  };
}

export function computePromotionContentDigest(content: PromotionContent): string {
  return `sha256:${createHash('sha256')
    .update(stableSerialize(normalizePromotionContent(content)))
    .digest('hex')}`;
}
