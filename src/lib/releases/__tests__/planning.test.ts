import { describe, expect, it } from 'bun:test';
import { getPromotionSourceBlockingReason, summarizeReleasePlan } from '@/lib/releases/planning';
import { buildReleasePlanningPanel } from '@/lib/releases/planning-view';
import { previewDatabaseGuardMessage } from '@/lib/releases/preview-database-guard';

describe('release planning', () => {
  it('blocks promotion when the source environment latest release failed', () => {
    expect(
      getPromotionSourceBlockingReason({
        sourceEnvironmentName: 'staging',
        latestRelease: {
          status: 'failed',
          sourceCommitSha: 'ce8e87038397bb2fab8a9d9c07bcf361920baec1',
        },
        deployableArtifactCount: 2,
        deploymentStatuses: ['running', 'failed'],
      })
    ).toBe('staging 最新发布 ce8e870 当前状态为失败，不能提升历史成功版本');
  });

  it('blocks promotion when a succeeded source release has an unhealthy deployment', () => {
    expect(
      getPromotionSourceBlockingReason({
        sourceEnvironmentName: 'staging',
        latestRelease: {
          status: 'succeeded',
          sourceCommitSha: '313ccb1177b48f0e4e7f36f6d77b04ea81126fda',
        },
        deployableArtifactCount: 2,
        deploymentStatuses: ['running', 'verification_failed'],
      })
    ).toBe('staging 最新成功发布仍有服务未运行：校验失败');
  });

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

  it('presents approval-gated production plans without duplicate approval chips', () => {
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
            approvalPolicy: 'manual_in_production',
          },
        },
      ],
    });

    const panel = buildReleasePlanningPanel({ plan });
    const approvalChips = panel.chips.filter((chip) => chip.key === 'approval-gate');
    const productionProtectionChips = panel.chips.filter(
      (chip) => chip.key === 'production-protection'
    );

    expect(approvalChips).toEqual([{ key: 'approval-gate', label: '等待审批', tone: 'neutral' }]);
    expect(productionProtectionChips.length).toBe(1);
    expect(panel.canSubmit).toBe(true);
    expect(panel.issueSummary).toBe(
      '这次发布包含 1 个生产前置迁移，需要在发布详情审批后才会执行。'
    );
    expect(panel.warningChips.map((chip) => chip.label)).not.toContain(
      '发布流程会等待审批，通过后才执行生产迁移。'
    );
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

  it('presents schema blockers before approval-only guidance', () => {
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
            approvalPolicy: 'manual_in_production',
          },
        },
      ],
      schemaGate: {
        canCreate: false,
        checkedCount: 1,
        blockingCount: 1,
        blockingReason: '存在 1 个数据库 schema 门禁未满足',
        summary: '数据库账本与仓库迁移链不一致',
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
            summary: '数据库账本与仓库迁移链不一致',
          },
        ],
      },
    });

    const panel = buildReleasePlanningPanel({ plan });

    expect(plan.issue?.code).toBe('approval_blocked');
    expect(panel.canSubmit).toBe(false);
    expect(panel.issueSummary).toBe(
      '存在 1 个数据库 schema 门禁未满足：数据库账本与仓库迁移链不一致'
    );
    expect(panel.issueSummary).not.toContain('发布详情审批');
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

  it('blocks inherited preview databases from running branch migrations', () => {
    const plan = summarizeReleasePlan({
      environment: {
        kind: 'preview',
        isProduction: false,
        isPreview: true,
        databaseStrategy: 'inherit',
      },
      services: [{ id: 'svc-1', name: 'web', image: 'ghcr.io/demo/web:1' }],
      migrationSpecs: [
        {
          environment: { isProduction: false, isPreview: true },
          specification: {
            executionMode: 'automatic',
            phase: 'preDeploy',
            compatibility: 'backward_compatible',
            approvalPolicy: 'auto',
          },
        },
      ],
    });

    expect(plan.canCreate).toBe(false);
    expect(plan.blockingReason).toBe(previewDatabaseGuardMessage);
    expect(plan.summary).toBe(previewDatabaseGuardMessage);
    expect(
      plan.platformSignals.chips.some(
        (chip) => chip.key === 'preview-database:inherit-migration-blocked'
      )
    ).toBe(true);
  });
});
