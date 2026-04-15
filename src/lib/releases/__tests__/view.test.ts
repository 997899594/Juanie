import { describe, expect, it } from 'bun:test';
import {
  buildReleaseListStats,
  decorateReleaseList,
  normalizeReleaseRiskFilterState,
} from '@/lib/releases/view';

describe('release list view', () => {
  it('defaults release risk filter to attention', () => {
    expect(normalizeReleaseRiskFilterState()).toBe('attention');
    expect(normalizeReleaseRiskFilterState('weird')).toBe('attention');
    expect(normalizeReleaseRiskFilterState('all')).toBe('all');
  });

  it('counts release attention stats from all actionable states', () => {
    expect(
      buildReleaseListStats([
        {
          status: 'awaiting_external_completion',
          approvalRunsCount: 0,
          failedMigrationRunsCount: 0,
        },
        {
          status: 'succeeded',
          approvalRunsCount: 1,
          failedMigrationRunsCount: 0,
        },
        {
          status: 'verification_failed',
          approvalRunsCount: 0,
          failedMigrationRunsCount: 1,
        },
      ])
    ).toEqual([
      { label: '发布', value: 3 },
      { label: '待处理', value: 3 },
      { label: '失败', value: 1 },
    ]);
  });

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
