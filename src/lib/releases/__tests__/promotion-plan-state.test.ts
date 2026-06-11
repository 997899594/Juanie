import { describe, expect, it } from 'bun:test';
import {
  isPromotionPlanWaitingOnlyOnSchemaInspection,
  markPromotionPlanSchemaRefreshQueued,
} from '@/lib/releases/promotion-plan-state';
import type { ProjectPromotionPlanView } from '@/lib/releases/service';

function buildPlan(): ProjectPromotionPlanView {
  return {
    flowId: null,
    strategy: 'reuse_release_artifacts',
    requiresApproval: true,
    isAlreadyPromoted: false,
    sourceRelease: {
      id: 'release-source',
      summary: 'main 发布',
      sourceCommitSha: 'cd7ddc943a8',
    },
    sourceEnvironment: {
      id: 'env-staging',
      name: 'staging',
      isProduction: false,
    },
    targetEnvironment: {
      id: 'env-prod',
      name: 'production',
      isProduction: true,
    },
    ai: null,
    plan: {
      canCreate: false,
      blockingReason: '数据库 schema 尚未检查，请刷新检查后再创建发布',
      services: [{ id: 'svc-web', name: 'web', image: 'ghcr.io/demo/web:1' }],
      environmentPolicy: {
        level: 'normal',
        reasons: [],
        signals: [],
        primarySignal: null,
        summary: null,
      },
      releasePolicy: {
        level: 'approval_required',
        reasons: ['生产环境发布需要人工审批'],
        signals: [],
        primarySignal: null,
        requiresApproval: true,
        summary: '生产环境发布需要人工审批',
      },
      issue: null,
      platformSignals: {
        chips: [
          {
            key: 'schema:blocking',
            label: 'Schema 门禁 1 项',
            tone: 'danger',
          },
          {
            key: 'schema:unknown',
            label: 'Schema 待检查 1 项',
            tone: 'neutral',
          },
        ],
        primarySummary: '尚未有当前版本的 schema 检查结果。',
        nextActionLabel: '刷新 Schema 检查',
      },
      migration: {
        preDeployCount: 1,
        postDeployCount: 0,
        automaticCount: 1,
        manualPlatformCount: 0,
        externalCount: 0,
        warnings: [],
        signals: [],
        primarySignal: null,
        requiresApproval: true,
        requiresExternalCompletion: false,
      },
      schema: {
        checkedCount: 1,
        blockingCount: 1,
        states: [
          {
            databaseId: 'db-1',
            databaseName: 'postgresql',
            status: 'unknown',
            statusLabel: '待检查',
            summary: '尚未有当前版本的 schema 检查结果。',
            freshness: 'missing',
            refreshStatus: 'idle',
          },
        ],
        summary: '尚未有当前版本的 schema 检查结果。',
        nextActionLabel: '刷新 Schema 检查',
        refresh: {
          requested: false,
          queuedCount: 0,
          runningCount: 0,
          unavailableCount: 0,
          failedCount: 0,
          missingCount: 1,
        },
      },
      environmentInheritance: null,
      environmentDatabaseStrategy: null,
      summary: '数据库 schema 尚未检查，请刷新检查后再创建发布',
    },
  };
}

describe('promotion plan state', () => {
  it('recognizes schema-only missing inspection blockers', () => {
    expect(isPromotionPlanWaitingOnlyOnSchemaInspection(buildPlan())).toBe(true);
  });

  it('marks schema-only missing inspection as queued refresh without keeping blocked chips', () => {
    const plan = markPromotionPlanSchemaRefreshQueued(buildPlan());

    expect(plan?.plan.canCreate).toBe(true);
    expect(plan?.plan.blockingReason).toBe(null);
    expect(plan?.plan.schema.blockingCount).toBe(0);
    expect(plan?.plan.schema.refresh?.queuedCount).toBe(1);
    expect(plan?.plan.schema.states[0]?.refreshStatus).toBe('queued');
    expect(plan?.plan.platformSignals.primarySummary).toContain('准入会继续等待检查');
    expect(plan?.plan.platformSignals.chips.some((chip) => chip.key === 'schema:refreshing')).toBe(
      true
    );
    expect(plan?.plan.platformSignals.chips.some((chip) => chip.key === 'schema:blocking')).toBe(
      false
    );
  });
});
