import { describe, expect, it } from 'bun:test';
import type { environments, promotionFlows } from '@/lib/db/schema';
import { resolvePrimaryPromotionFlow, resolvePromotionFlows } from '@/lib/environments/promotion';

type EnvironmentRecord = typeof environments.$inferSelect;
type PromotionFlowRecord = typeof promotionFlows.$inferSelect;

describe('resolvePrimaryPromotionFlow', () => {
  const environmentsList = [
    {
      id: 'env_staging',
      projectId: 'project_1',
      name: 'staging',
      kind: 'persistent',
      branch: 'main',
      tagPattern: null,
      isPreview: false,
      previewPrNumber: null,
      expiresAt: null,
      databaseStrategy: 'direct',
      autoDeploy: true,
      isProduction: false,
      deploymentStrategy: 'rolling',
      deploymentRuntime: 'native_k8s',
      deliveryMode: 'direct',
      baseEnvironmentId: null,
      previewBuildStatus: null,
      previewBuildSourceRef: null,
      previewBuildSourceCommitSha: null,
      previewBuildStartedAt: null,
      namespace: 'juanie-demo-staging',
      createdAt: new Date('2026-04-15T00:00:00.000Z'),
      updatedAt: new Date('2026-04-15T00:00:00.000Z'),
    },
    {
      id: 'env_production',
      projectId: 'project_1',
      name: 'production',
      kind: 'production',
      branch: null,
      tagPattern: null,
      isPreview: false,
      previewPrNumber: null,
      expiresAt: null,
      databaseStrategy: 'direct',
      autoDeploy: false,
      isProduction: true,
      deploymentStrategy: 'controlled',
      deploymentRuntime: 'argo_rollouts',
      deliveryMode: 'promote_only',
      baseEnvironmentId: null,
      previewBuildStatus: null,
      previewBuildSourceRef: null,
      previewBuildSourceCommitSha: null,
      previewBuildStartedAt: null,
      namespace: 'juanie-demo-prod',
      createdAt: new Date('2026-04-15T00:00:00.000Z'),
      updatedAt: new Date('2026-04-15T00:00:00.000Z'),
    },
  ] as EnvironmentRecord[];

  it('prefers explicit promotion flows', () => {
    const flows = [
      {
        id: 'flow_1',
        projectId: 'project_1',
        sourceEnvironmentId: 'env_staging',
        targetEnvironmentId: 'env_production',
        requiresApproval: true,
        strategy: 'reuse_release_artifacts',
        isActive: true,
        createdAt: new Date('2026-04-15T00:00:00.000Z'),
        updatedAt: new Date('2026-04-15T00:00:00.000Z'),
      },
    ] as PromotionFlowRecord[];

    const result = resolvePrimaryPromotionFlow({
      environments: environmentsList,
      promotionFlows: flows,
    });

    expect(result.flow?.id).toBe('flow_1');
    expect(result.sourceEnvironment?.id).toBe('env_staging');
    expect(result.targetEnvironment?.id).toBe('env_production');
  });

  it('returns an empty resolution when no explicit flow exists', () => {
    const result = resolvePrimaryPromotionFlow({
      environments: environmentsList,
      promotionFlows: [],
    });

    expect(result.flow).toBe(null);
    expect(result.sourceEnvironment).toBe(null);
    expect(result.targetEnvironment).toBe(null);
  });

  it('returns every active promotion flow in topology order', () => {
    const extendedEnvironments = [
      {
        ...environmentsList[0],
        id: 'env_dev',
        name: 'dev',
        branch: 'develop',
        autoDeploy: true,
      },
      environmentsList[0],
      environmentsList[1],
    ] as EnvironmentRecord[];
    const flows = [
      {
        id: 'flow_prod',
        projectId: 'project_1',
        sourceEnvironmentId: 'env_staging',
        targetEnvironmentId: 'env_production',
        requiresApproval: true,
        strategy: 'reuse_release_artifacts',
        isActive: true,
        createdAt: new Date('2026-04-16T01:00:00.000Z'),
        updatedAt: new Date('2026-04-16T01:00:00.000Z'),
      },
      {
        id: 'flow_test',
        projectId: 'project_1',
        sourceEnvironmentId: 'env_dev',
        targetEnvironmentId: 'env_staging',
        requiresApproval: false,
        strategy: 'reuse_release_artifacts',
        isActive: true,
        createdAt: new Date('2026-04-16T02:00:00.000Z'),
        updatedAt: new Date('2026-04-16T02:00:00.000Z'),
      },
    ] as PromotionFlowRecord[];

    const result = resolvePromotionFlows({
      environments: extendedEnvironments,
      promotionFlows: flows,
    });

    expect(result.map((flow) => flow.flow?.id)).toEqual(['flow_test', 'flow_prod']);
    expect(result[0]?.sourceEnvironment?.id).toBe('env_dev');
    expect(result[0]?.targetEnvironment?.id).toBe('env_staging');
    expect(result[1]?.sourceEnvironment?.id).toBe('env_staging');
    expect(result[1]?.targetEnvironment?.id).toBe('env_production');
  });
});
