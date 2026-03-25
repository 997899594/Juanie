import { describe, expect, it } from 'bun:test';
import { decorateReleaseList } from '@/lib/releases/view';

describe('release list view', () => {
  it('adds intelligence and diff summaries in environment scope order', () => {
    const releases = decorateReleaseList([
      {
        id: 'r2',
        status: 'succeeded',
        errorMessage: null,
        environment: { id: 'env-1', isProduction: false, isPreview: false, expiresAt: null },
        artifacts: [
          {
            service: { id: 'svc-1', name: 'web' },
            imageUrl: 'ghcr.io/demo/web:2',
            imageDigest: null,
          },
        ],
        deployments: [{ status: 'running' }],
        migrationRuns: [],
      },
      {
        id: 'r1',
        status: 'succeeded',
        errorMessage: null,
        environment: { id: 'env-1', isProduction: false, isPreview: false, expiresAt: null },
        artifacts: [
          {
            service: { id: 'svc-1', name: 'web' },
            imageUrl: 'ghcr.io/demo/web:1',
            imageDigest: null,
          },
        ],
        deployments: [{ status: 'running' }],
        migrationRuns: [],
      },
    ]);

    expect(releases[0]?.diffSummary.isFirstRelease).toBe(false);
    expect(releases[0]?.diffSummary.artifactChanges).toBe(1);
    expect(releases[0]?.policy.level).toBe('normal');
    expect(releases[1]?.diffSummary.isFirstRelease).toBe(true);
    expect(releases[1]?.intelligence.riskLevel).toBe('low');
  });
});
