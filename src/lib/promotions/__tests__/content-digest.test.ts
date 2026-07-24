import { describe, expect, it } from 'bun:test';
import { computePromotionContentDigest } from '@/lib/promotions/content-digest';

const base = {
  sourceReleaseId: 'release-1',
  targetEnvironmentId: 'production',
  sourceCommitSha: 'abc',
  migrationApprovalMode: 'independent_release_plan' as const,
  artifacts: [
    {
      serviceId: 'web',
      image: 'ghcr.io/acme/web@sha256:a',
      digest: 'sha256:a',
      sbomUri: 'oci://web',
      provenanceUri: 'oci://web',
    },
    {
      serviceId: 'worker',
      image: 'ghcr.io/acme/worker@sha256:b',
      digest: 'sha256:b',
      sbomUri: 'oci://worker',
      provenanceUri: 'oci://worker',
    },
  ],
};

describe('promotion content digest', () => {
  it('is deterministic across artifact ordering', () => {
    expect(computePromotionContentDigest(base)).toBe(
      computePromotionContentDigest({ ...base, artifacts: [...base.artifacts].reverse() })
    );
  });

  it('changes when immutable content changes', () => {
    expect(computePromotionContentDigest(base)).not.toBe(
      computePromotionContentDigest({
        ...base,
        artifacts: [{ ...base.artifacts[0], digest: 'sha256:changed' }],
      })
    );
  });
});
