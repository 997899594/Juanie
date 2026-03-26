import { describe, expect, it } from 'bun:test';
import {
  buildProjectOverviewDetails,
  buildProjectOverviewStats,
  decorateProjectAttentionRuns,
  decorateProjectDatabaseCards,
  decorateProjectDomains,
  decorateProjectRecentReleases,
  decorateProjectServices,
} from '@/lib/projects/view';

describe('project database view', () => {
  it('prefers service-scoped release and image over project scope', () => {
    const result = decorateProjectDatabaseCards(
      [
        {
          id: 'db-1',
          environmentId: 'env-1',
          serviceId: 'svc-1',
        },
      ],
      {
        services: [{ id: 'svc-1', name: 'web' }],
        recentMigrationRuns: [
          {
            id: 'run-1',
            databaseId: 'db-1',
            status: 'failed',
            releaseId: 'rel-2',
          },
        ],
        recentReleases: [
          {
            id: 'rel-2',
            summary: 'service release',
            sourceCommitSha: 'abcdef1234567',
            environment: { id: 'env-1' },
            artifacts: [{ service: { id: 'svc-1', name: 'web' } }],
          },
          {
            id: 'rel-1',
            summary: 'project release',
            sourceCommitSha: '1234567abcdef',
            environment: { id: 'env-1' },
            artifacts: [],
          },
        ],
        deploymentImageCandidates: [
          {
            environmentId: 'env-1',
            serviceId: null,
            imageUrl: 'ghcr.io/demo/project:1',
          },
          {
            environmentId: 'env-1',
            serviceId: 'svc-1',
            imageUrl: 'ghcr.io/demo/web:2',
          },
        ],
      }
    );

    expect(result[0]?.serviceName).toBe('web');
    expect(result[0]?.latestRelease?.id).toBe('rel-2');
    expect(result[0]?.latestRelease?.title).toBe('service release');
    expect(result[0]?.latestImageUrl).toBe('ghcr.io/demo/web:2');
    expect(result[0]?.manualControl.issueLabel).toBe('迁移失败');
    expect(result[0]?.manualControl.actionLabel).toBe('去 release 重试');
  });

  it('falls back to project-scoped release and image when service scope is missing', () => {
    const result = decorateProjectDatabaseCards(
      [
        {
          id: 'db-1',
          environmentId: 'env-1',
          serviceId: 'svc-1',
        },
      ],
      {
        services: [{ id: 'svc-1', name: 'web' }],
        recentMigrationRuns: [],
        recentReleases: [
          {
            id: 'rel-1',
            summary: 'project release',
            sourceCommitSha: '1234567abcdef',
            environment: { id: 'env-1' },
            artifacts: [],
          },
        ],
        deploymentImageCandidates: [
          {
            environmentId: 'env-1',
            serviceId: null,
            imageUrl: 'ghcr.io/demo/project:1',
          },
        ],
      }
    );

    expect(result[0]?.latestRelease?.id).toBe('rel-1');
    expect(result[0]?.latestImageUrl).toBe('ghcr.io/demo/project:1');
    expect(result[0]?.manualControl.actionLabel).toBe('优先走 release');
  });

  it('decorates attention runs with shared issue and action labels', () => {
    const result = decorateProjectAttentionRuns([
      { status: 'awaiting_approval' },
      { status: 'failed' },
    ]);

    expect(result[0]?.issueCode).toBe('approval_blocked');
    expect(result[0]?.issueLabel).toBe('审批阻塞');
    expect(result[0]?.actionLabel).toBe('处理迁移审批');
    expect(result[1]?.issueCode).toBe('migration_failed');
    expect(result[1]?.issueLabel).toBe('迁移失败');
    expect(result[1]?.actionLabel).toBe('检查迁移并重试');
  });

  it('builds overview stats in the expected order', () => {
    expect(
      buildProjectOverviewStats({
        serviceCount: 3,
        databaseCount: 2,
        attentionCount: 1,
        releaseCount: 5,
      })
    ).toEqual([
      { label: '服务', value: 3 },
      { label: '数据库', value: 2 },
      { label: '待处理', value: 1 },
      { label: '发布', value: 5 },
    ]);
  });

  it('decorates recent releases with display metadata', () => {
    const result = decorateProjectRecentReleases([
      {
        id: 'rel-1',
        summary: 'main 发布 · abc1234',
        sourceCommitSha: 'abc1234def5678',
        sourceRef: 'refs/heads/main',
        environment: { id: 'env-1', isPreview: false },
        artifacts: [],
      },
    ]);

    expect(result[0]?.title).toBe('main 发布 · abc1234');
    expect(result[0]?.shortCommitSha).toBe('abc1234');
    expect(result[0]?.sourceSummary).toBe('abc1234 refs/heads/main');
  });

  it('builds overview details with repository metadata', () => {
    const result = buildProjectOverviewDetails('平台团队', {
      status: 'active',
      createdAt: '2026-03-20T00:00:00.000Z',
      productionBranch: 'main',
      description: '测试项目',
      repository: {
        fullName: 'juanie/demo',
        webUrl: 'https://github.com/juanie/demo',
      },
    });

    expect(result.headerDescription).toBe('平台团队 · 运行中');
    expect(result.repository?.fullName).toBe('juanie/demo');
    expect(result.productionBranch).toBe('main');
    expect(result.description).toBe('测试项目');
  });

  it('decorates services and domains with display metadata', () => {
    const services = decorateProjectServices([
      { id: 'svc-1', name: 'web', status: 'active', port: 3000 },
    ]);
    const domains = decorateProjectDomains([{ hostname: 'demo.juanie.run' }]);

    expect(services[0]?.statusLabel).toBe('运行中');
    expect(services[0]?.portLabel).toBe(':3000');
    expect(domains[0]?.url).toBe('https://demo.juanie.run');
  });
});
