import { describe, expect, it } from 'bun:test';
import { buildProjectReleasesPageData, buildReleaseDetailPageData } from '@/lib/releases/service';

describe('release service', () => {
  it('defaults fixed environment release pages to all statuses', () => {
    const result = buildProjectReleasesPageData({
      releaseItems: [
        {
          id: 'rel-1',
          displayTitle: 'main 发布 · abcdef1',
          status: 'succeeded',
          statusDecoration: { color: 'success', pulse: false, label: '成功' },
          riskLabel: '低风险',
          sourceRef: 'refs/heads/main',
          sourceCommitSha: 'abcdef1234567890',
          createdAt: '2026-04-28T00:00:00.000Z',
          recap: null,
          approvalRunsCount: 0,
          failedMigrationRunsCount: 0,
          previewSourceMeta: {
            kind: 'branch',
            label: 'main',
            title: 'main',
            reference: 'refs/heads/main',
            detail: null,
            stateLabel: null,
            authorName: null,
            webUrl: null,
          },
          platformSignals: {
            chips: [],
            primarySummary: null,
            nextActionLabel: null,
          },
          primaryDomainUrl: null,
          environmentScope: 'staging',
          environment: {
            id: 'env-staging',
            name: 'staging',
            isProduction: false,
            isPreview: false,
            scopeLabel: '长期环境',
            sourceLabel: 'main',
          },
          artifacts: [],
        },
      ],
      manualReleaseSources: [],
      environments: [
        {
          id: 'env-staging',
          name: 'staging',
          kind: 'persistent',
          autoDeploy: true,
          isProduction: false,
        },
        {
          id: 'env-production',
          name: 'production',
          kind: 'production',
          autoDeploy: false,
          isProduction: true,
        },
      ],
      role: 'member',
      promotionPlans: [],
      envFilter: 'env-staging',
      riskFilter: null,
      fixedEnvFilter: true,
    });

    expect(result.defaultRiskFilter).toBe('all');
    expect(result.selectedRisk).toBe('all');
    expect(result.filteredReleaseItems.length).toBe(1);
    expect(result.environmentOptions).toEqual([{ value: 'env-staging', label: 'staging' }]);
  });

  it('keeps project release pages on attention by default', () => {
    const result = buildProjectReleasesPageData({
      releaseItems: [
        {
          id: 'rel-1',
          displayTitle: 'main 发布 · abcdef1',
          status: 'succeeded',
          statusDecoration: { color: 'success', pulse: false, label: '成功' },
          riskLabel: '低风险',
          sourceRef: 'refs/heads/main',
          sourceCommitSha: 'abcdef1234567890',
          createdAt: '2026-04-28T00:00:00.000Z',
          recap: null,
          approvalRunsCount: 0,
          failedMigrationRunsCount: 0,
          previewSourceMeta: {
            kind: 'branch',
            label: 'main',
            title: 'main',
            reference: 'refs/heads/main',
            detail: null,
            stateLabel: null,
            authorName: null,
            webUrl: null,
          },
          platformSignals: {
            chips: [],
            primarySummary: null,
            nextActionLabel: null,
          },
          primaryDomainUrl: null,
          environmentScope: 'staging',
          environment: {
            id: 'env-staging',
            name: 'staging',
            isProduction: false,
            isPreview: false,
            scopeLabel: '长期环境',
            sourceLabel: 'main',
          },
          artifacts: [],
        },
      ],
      manualReleaseSources: [],
      environments: [
        {
          id: 'env-staging',
          name: 'staging',
          kind: 'persistent',
          autoDeploy: true,
          isProduction: false,
        },
      ],
      role: 'member',
      promotionPlans: [],
      riskFilter: null,
    });

    expect(result.defaultRiskFilter).toBe('attention');
    expect(result.selectedRisk).toBe('attention');
    expect(result.filteredReleaseItems.length).toBe(0);
    expect(result.environmentOptions).toEqual([
      { value: 'all', label: '全部环境' },
      { value: 'env-staging', label: 'staging' },
    ]);
  });

  it('builds release detail page data and previous release link', () => {
    const result = buildReleaseDetailPageData({
      projectId: 'proj-1',
      release: {
        id: 'rel-2',
        projectId: 'proj-1',
        environmentId: 'env-1',
        createdAt: new Date('2026-03-26T10:00:00.000Z'),
        updatedAt: new Date('2026-03-26T10:10:00.000Z'),
        status: 'degraded',
        errorMessage: null,
        sourceRef: 'refs/pull/42/head',
        sourceCommitSha: 'abcdef1234567890',
        sourceRepository: 'demo/repo',
        sourceRelease: {
          id: 'rel-source',
          summary: 'Promote staging · abcdef1',
          sourceRef: 'refs/heads/main',
          sourceCommitSha: 'abcdef1234567890',
          environment: {
            id: 'env-staging',
            name: 'staging',
            isPreview: false,
            isProduction: false,
          },
        },
        environment: {
          id: 'env-1',
          name: 'preview-pr-42',
          isPreview: true,
          expiresAt: '2099-03-26T00:00:00.000Z',
          domains: [{ id: 'dom-1', hostname: 'preview.example.com', isPrimary: true }],
        },
        artifacts: [
          {
            id: 'art-1',
            service: { id: 'svc-1', name: 'web' },
            imageUrl: 'ghcr.io/demo/web:2',
            imageDigest: null,
          },
        ],
        deployments: [{ id: 'dep-1', status: 'running', serviceId: 'svc-1' }],
        migrationRuns: [
          {
            id: 'run-1',
            status: 'awaiting_approval',
            service: { id: 'svc-1', name: 'web' },
            serviceId: 'svc-1',
            database: { id: 'db-1', name: 'postgres' },
            specification: { tool: 'drizzle', phase: 'preDeploy', command: 'bun run db:push' },
          },
        ],
      },
      previousRelease: {
        id: 'rel-1',
        sourceRef: 'refs/heads/main',
        sourceCommitSha: '1234567890abcdef',
        environment: { id: 'env-0', isPreview: false },
        artifacts: [
          {
            service: { id: 'svc-1', name: 'web' },
            imageUrl: 'ghcr.io/demo/web:1',
            imageDigest: null,
          },
        ],
        migrationRuns: [],
      },
    });

    expect(result).not.toBe(null);
    expect(result?.release.diff.changedArtifacts.length).toBe(1);
    expect(result?.previousReleaseLink).toEqual({
      id: 'rel-1',
      environmentId: 'env-0',
      title: 'main 发布 · 1234567',
    });
    expect(result?.sourceReleaseLink).toEqual({
      id: 'rel-source',
      environmentId: 'env-staging',
      title: 'Promote staging · abcdef1',
      environmentName: 'staging',
    });
  });

  it('returns null for project scope mismatches', () => {
    const result = buildReleaseDetailPageData({
      projectId: 'proj-1',
      release: {
        id: 'rel-2',
        projectId: 'proj-2',
        environmentId: 'env-1',
        createdAt: new Date(),
        updatedAt: new Date(),
        status: 'queued',
        errorMessage: null,
        environment: { id: 'env-1' },
        artifacts: [],
        deployments: [],
        migrationRuns: [],
      },
      previousRelease: null,
    });

    expect(result).toBe(null);
  });
});
