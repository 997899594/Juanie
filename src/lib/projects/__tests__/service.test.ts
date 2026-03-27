import { describe, expect, it } from 'bun:test';
import { buildProjectOverviewPageData } from '@/lib/projects/service';

describe('project overview service', () => {
  it('builds a page view model from fetched project data', () => {
    const result = buildProjectOverviewPageData({
      project: {
        id: 'proj-1',
        name: 'demo',
        teamId: 'team-1',
        status: 'active',
        createdAt: '2026-03-20T00:00:00.000Z',
        productionBranch: 'main',
        description: 'demo project',
        repository: {
          id: 'repo-1',
          fullName: 'juanie/demo',
          webUrl: 'https://github.com/juanie/demo',
        },
      } as never,
      governance: null,
      team: { id: 'team-1', name: '平台团队' } as never,
      projectEnvironments: [
        {
          id: 'env-1',
          name: 'production',
          isProduction: true,
          isPreview: false,
          branch: 'main',
          deploymentStrategy: 'rolling',
          databaseStrategy: 'direct',
          domains: [{ id: 'dom-1', hostname: 'demo.juanie.run' }],
          databases: [],
          baseEnvironment: null,
        },
      ],
      projectServices: [
        { id: 'svc-1', name: 'web', status: 'active', port: 3000, type: 'web' },
      ] as never,
      projectDatabases: [
        {
          id: 'db-1',
          name: 'postgres',
          type: 'postgresql',
          status: 'active',
          scope: 'project',
          environmentId: 'env-1',
          serviceId: null,
        },
      ] as never,
      projectDomains: [{ id: 'dom-1', hostname: 'demo.juanie.run' }] as never,
      recentReleases: [
        {
          id: 'rel-1',
          summary: 'main 发布 · abc1234',
          sourceCommitSha: 'abc1234def5678',
          sourceRef: 'refs/heads/main',
          environment: { id: 'env-1', name: 'production', isPreview: false },
          artifacts: [],
          status: 'succeeded',
        },
      ] as never,
      recentMigrationRuns: [] as never,
      deploymentImageCandidates: [] as never,
    });

    expect(result.overview.headerDescription).toBe('平台团队 · 运行中');
    expect(result.stats[0]?.value).toBe(1);
    expect(result.environmentCards[0]?.name).toBe('production');
    expect(result.serviceCards[0]?.name).toBe('web');
    expect(result.domainCards[0]?.url).toBe('https://demo.juanie.run');
    expect(result.recentReleaseCards[0]?.title).toBe('main 发布 · abc1234');
  });
});
