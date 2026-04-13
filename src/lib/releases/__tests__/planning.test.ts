import { describe, expect, it } from 'bun:test';
import { summarizeReleasePlan } from '@/lib/releases/planning';

describe('release planning', () => {
  it('summarizes approval-gated production plans', () => {
    const plan = summarizeReleasePlan({
      environment: { isProduction: true, isPreview: false },
      services: [{ id: 'svc-1', name: 'web', image: 'ghcr.io/demo/web:1' }],
      migrationSpecs: [
        {
          environment: { isProduction: true, isPreview: false },
          specification: {
            executionMode: 'automatic',
            phase: 'preDeploy',
            compatibility: 'breaking',
            approvalPolicy: 'auto',
          },
        },
      ],
    });

    expect(plan.canCreate).toBe(true);
    expect(plan.releasePolicy.requiresApproval).toBe(true);
    expect(plan.migration.requiresApproval).toBe(true);
    expect(plan.migration.preDeployCount).toBe(1);
    expect(plan.migration.automaticCount).toBe(1);
    expect(plan.summary).toBe('生产环境的破坏性迁移必须人工审批');
  });

  it('surfaces unresolved manual and external pre-deploy gates', () => {
    const plan = summarizeReleasePlan({
      environment: { isProduction: true, isPreview: false },
      services: [{ id: 'svc-1', name: 'web', image: 'ghcr.io/demo/web:1' }],
      migrationSpecs: [
        {
          environment: { isProduction: true, isPreview: false },
          specification: {
            executionMode: 'automatic',
            phase: 'preDeploy',
            compatibility: 'backward_compatible',
            approvalPolicy: 'auto',
          },
        },
        {
          environment: { isProduction: true, isPreview: false },
          specification: {
            executionMode: 'manual_platform',
            phase: 'preDeploy',
            compatibility: 'backward_compatible',
            approvalPolicy: 'manual_in_production',
          },
        },
        {
          environment: { isProduction: true, isPreview: false },
          specification: {
            executionMode: 'external',
            phase: 'preDeploy',
            compatibility: 'backward_compatible',
            approvalPolicy: 'auto',
          },
        },
        {
          environment: { isProduction: true, isPreview: false },
          specification: {
            executionMode: 'automatic',
            phase: 'postDeploy',
            compatibility: 'backward_compatible',
            approvalPolicy: 'auto',
          },
        },
      ],
    });

    expect(plan.blockingReason).toBe('存在未满足的前置迁移门禁');
    expect(plan.releasePolicy.requiresApproval).toBe(true);
    expect(plan.issue?.code).toBe('approval_blocked');
    expect(plan.migration.preDeployCount).toBe(3);
    expect(plan.migration.postDeployCount).toBe(1);
    expect(plan.migration.automaticCount).toBe(2);
    expect(plan.migration.manualPlatformCount).toBe(1);
    expect(plan.migration.externalCount).toBe(1);
    expect(plan.migration.requiresExternalCompletion).toBe(true);
  });

  it('blocks release creation when schema gate is not aligned', () => {
    const plan = summarizeReleasePlan({
      environment: { isProduction: false, isPreview: false },
      services: [{ id: 'svc-1', name: 'web', image: 'ghcr.io/demo/web:1' }],
      migrationSpecs: [],
      schemaGate: {
        canCreate: false,
        checkedCount: 1,
        blockingCount: 1,
        blockingReason: '存在 1 个数据库 schema 门禁未满足',
        summary: '数据库账本与仓库 Drizzle 迁移链不一致',
        nextActionLabel: '先在环境页处理数据库纳管',
        customSignals: [
          {
            key: 'schema:blocking',
            label: 'Schema 门禁 1 项',
            tone: 'danger',
          },
        ],
        states: [
          {
            databaseId: 'db-1',
            databaseName: 'postgresql',
            status: 'drifted',
            statusLabel: '已漂移',
            summary: '数据库账本与仓库 Drizzle 迁移链不一致',
          },
        ],
      },
    });

    expect(plan.canCreate).toBe(false);
    expect(plan.blockingReason).toBe('存在 1 个数据库 schema 门禁未满足');
    expect(plan.schema.blockingCount).toBe(1);
    expect(plan.summary).toBe('存在 1 个数据库 schema 门禁未满足');
    expect(plan.platformSignals.chips.some((chip) => chip.key === 'schema:blocking')).toBe(true);
  });

  it('allows release creation when schema gate only reports pending migrations', () => {
    const plan = summarizeReleasePlan({
      environment: { isProduction: false, isPreview: false },
      services: [{ id: 'svc-1', name: 'web', image: 'ghcr.io/demo/web:1' }],
      migrationSpecs: [],
      schemaGate: {
        canCreate: true,
        checkedCount: 1,
        blockingCount: 0,
        blockingReason: null,
        summary: '数据库落后于仓库迁移链，已执行 1/2 项，可通过正常发布补齐',
        nextActionLabel: null,
        customSignals: [
          {
            key: 'schema:pending_migrations',
            label: '待迁移 1 项',
            tone: 'neutral',
          },
        ],
        states: [
          {
            databaseId: 'db-1',
            databaseName: 'postgresql',
            status: 'pending_migrations',
            statusLabel: '待迁移',
            summary: '数据库落后于仓库迁移链，已执行 1/2 项，可通过正常发布补齐',
          },
        ],
      },
    });

    expect(plan.canCreate).toBe(true);
    expect(plan.blockingReason).toBe(null);
    expect(plan.schema.blockingCount).toBe(0);
    expect(
      plan.platformSignals.chips.some((chip) => chip.key === 'schema:pending_migrations')
    ).toBe(true);
  });
});
