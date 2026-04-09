import { describe, expect, it } from 'bun:test';
import { decorateReleaseDetail } from '@/lib/releases/view';

describe('release detail view', () => {
  it('decorates release detail with environment, diff and item metadata', () => {
    const release = decorateReleaseDetail(
      {
        id: 'rel-2',
        status: 'degraded',
        errorMessage: null,
        environment: {
          id: 'env-1',
          name: 'preview-pr-42',
          isPreview: true,
          expiresAt: '2099-03-26T00:00:00.000Z',
          domains: [{ id: 'dom-1', hostname: 'preview.example.com', isPrimary: true }],
        },
        artifacts: [
          {
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
      {
        artifacts: [
          {
            service: { id: 'svc-1', name: 'web' },
            imageUrl: 'ghcr.io/demo/web:1',
            imageDigest: null,
          },
        ],
        migrationRuns: [],
      }
    );

    expect(release.riskLabel).toBe('高风险');
    expect(release.primaryDomainUrl).toBe('https://preview.example.com');
    expect(release.diff.changedArtifacts.length).toBe(1);
    expect(release.approvalRunsCount).toBe(1);
    expect(release.stats.map((item) => item.label)).toEqual(['服务', '部署', '迁移']);
    expect(release.platformSignals.nextActionLabel).toBe('处理迁移审批');
    expect(
      release.metadataItems.some((item) => item.label === '发布 ID' && item.mono === true)
    ).toBe(true);
    expect(release.deploymentItems[0]?.serviceName).toBe('web');
    expect(release.migrationItems[0]?.imageUrl).toBe('ghcr.io/demo/web:2');
  });
});
