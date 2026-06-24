import { describe, expect, it } from 'bun:test';
import { decorateReleaseDetail } from '@/lib/releases/view';

describe('release detail view', () => {
  it('decorates release detail with environment, diff and item metadata', () => {
    const release = decorateReleaseDetail(
      {
        id: 'rel-2',
        status: 'degraded',
        errorMessage: null,
        projectId: 'proj-1',
        sourceRelease: {
          id: 'rel-1',
          summary: 'staging 发布 · abc1234',
          sourceRef: 'refs/heads/main',
          sourceCommitSha: 'abc123456789',
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
            service: { id: 'svc-1', name: 'web' },
            serviceId: 'svc-1',
            kind: 'image',
            imageUrl: 'ghcr.io/demo/web:2',
            imageDigest: null,
          },
          {
            kind: 'package',
            name: 'kit',
            variant: 'sdk',
            platform: 'any',
            uri: 'https://ci.example.com/artifacts/kit-sdk.tgz',
          },
        ],
        deployments: [
          {
            id: 'dep-1',
            status: 'running',
            serviceId: 'svc-1',
            diagnostics: [
              {
                id: 'diag-1',
                reason: 'verification_failed',
                summary: 'web pod failed readiness',
                capturedAt: '2026-06-24T00:00:00.000Z',
                snapshot: {
                  schemaVersion: 1,
                  capturedAt: '2026-06-24T00:00:00.000Z',
                  reason: 'verification_failed',
                  errorMessage: 'readiness failed',
                  namespace: 'juanie-demo-staging',
                  workload: {
                    kind: 'argo_rollout',
                    name: 'demo-web',
                    namespace: 'juanie-demo-staging',
                    summary: 'Argo Rollout demo-web · available 0 · desired 1',
                    selector: 'app=demo-web',
                    desiredReplicas: 1,
                    updatedReplicas: 1,
                    readyReplicas: 0,
                    availableReplicas: 0,
                    generation: 2,
                    observedGeneration: 2,
                    phase: 'Progressing',
                    image: 'ghcr.io/demo/web:2',
                    conditions: [],
                  },
                  pods: [],
                  events: [],
                  logTails: [],
                },
              },
            ],
          },
        ],
        migrationRuns: [
          {
            id: 'run-1',
            status: 'awaiting_approval',
            approvalToken: 'token-1',
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
            serviceId: 'svc-1',
            kind: 'image',
            imageUrl: 'ghcr.io/demo/web:1',
            imageDigest: null,
          },
        ],
        migrationRuns: [],
      }
    );

    expect(release.riskLabel).toBe('高风险');
    expect(release.primaryDomainUrl).toBe('https://preview.example.com');
    expect(release.diff.changedArtifacts.length).toBe(2);
    expect(release.approvalRunsCount).toBe(1);
    expect(release.stats.map((item) => item.label)).toEqual(['服务', '交付物', '部署', '迁移']);
    expect(release.platformSignals.nextActionLabel).toBe('处理迁移审批');
    expect(
      release.metadataItems.some((item) => item.label === '发布 ID' && item.mono === true)
    ).toBe(true);
    expect(
      release.metadataItems.some(
        (item) => item.label === '来源发布' && item.value.includes('staging')
      )
    ).toBe(true);
    expect(release.timeline.some((item) => item.key === 'source-release-rel-1')).toBe(true);
    expect(release.timeline.map((item) => item.title)).toContain('创建发布');
    expect(release.timeline.map((item) => item.title)).toContain('迁移待审批');
    expect(release.timeline.map((item) => item.title)).toContain('web 运行中');
    expect(release.timeline.map((item) => item.title)).toContain('发布降级');
    expect(release.timeline.map((item) => item.title)).not.toContain('发布发布中');
    expect(release.timeline.map((item) => item.title)).not.toContain('部署发布中');
    expect(release.deploymentItems[0]?.serviceName).toBe('web');
    expect(release.deploymentItems[0]?.diagnostic?.summary).toBe('web pod failed readiness');
    expect(release.migrationItems[0]?.imageUrl).toBe('ghcr.io/demo/web:2');
    expect(release.migrationItems[0]?.approvalToken).toBe('token-1');
  });

  it('does not render rollout-ready timeline when a sibling deployment already failed', () => {
    const release = decorateReleaseDetail(
      {
        id: 'rel-3',
        status: 'awaiting_rollout',
        errorMessage: null,
        projectId: 'proj-1',
        environment: {
          id: 'env-prod',
          name: 'production',
          isProduction: true,
          isPreview: false,
          deploymentStrategy: 'controlled',
        },
        artifacts: [
          {
            service: { id: 'svc-web', name: 'web' },
            serviceId: 'svc-web',
            kind: 'image',
            imageUrl: 'ghcr.io/demo/web:2',
            imageDigest: null,
          },
          {
            service: { id: 'svc-worker', name: 'worker' },
            serviceId: 'svc-worker',
            kind: 'image',
            imageUrl: 'ghcr.io/demo/worker:2',
            imageDigest: null,
          },
        ],
        deployments: [
          { id: 'dep-web', status: 'awaiting_rollout', serviceId: 'svc-web' },
          {
            id: 'dep-worker',
            status: 'verification_failed',
            serviceId: 'svc-worker',
            errorMessage: 'worker exited with code 1',
          },
        ],
        migrationRuns: [],
      },
      null
    );

    expect(release.blockingReason?.label).toBe('校验失败');
    expect(release.timeline.map((item) => item.title)).not.toContain('渐进式发布待推进');
    expect(release.timeline.map((item) => item.title)).toContain('worker 校验失败');
  });
});
