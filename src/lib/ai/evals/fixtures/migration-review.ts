import type { JuanieEvalFixture } from '@/lib/ai/evals/types';
import type { EnvironmentMigrationReviewEvidence } from '@/lib/ai/evidence/environment-migration-review';
import type { MigrationReview } from '@/lib/ai/schemas/migration-review';

export const migrationReviewEvalFixture: JuanieEvalFixture<
  EnvironmentMigrationReviewEvidence,
  MigrationReview
> = {
  id: 'migration-review-awaiting-approval',
  promptKey: 'migration-review',
  promptVersion: 'v1',
  pluginId: 'migration-review',
  skillId: 'migration-skill',
  scope: 'environment',
  scenario: '环境存在待审批迁移和失败记录，需要明确指出阻塞点。',
  inputSummary: '共有 4 次 migration run，其中 1 次待审批，1 次失败，schema 有 1 个 blocked。',
  input: {
    teamId: 'team_alpha',
    projectId: 'proj_alpha',
    projectName: 'Alpha',
    environmentId: 'env_prod',
    environmentName: 'Production',
    latestReleaseTitle: 'Release #128',
    latestMigrationStatus: 'awaiting_approval',
    migration: {
      totalRuns: 4,
      awaitingApprovalCount: 1,
      awaitingExternalCount: 0,
      failedCount: 1,
      runningCount: 0,
      latestStatusLabel: 'awaiting_approval',
    },
    schema: {
      databaseCount: 2,
      blockedCount: 1,
      pendingCount: 0,
      summary: '2 个数据库 · 1 个阻塞',
    },
    attentionRuns: [
      {
        id: 'mig_001',
        serviceName: 'api',
        databaseName: 'primary',
        status: 'awaiting_approval',
        errorMessage: null,
        createdAt: '2026-04-22T16:00:00.000Z',
      },
      {
        id: 'mig_000',
        serviceName: 'worker',
        databaseName: 'analytics',
        status: 'failed',
        errorMessage: 'column lock timeout',
        createdAt: '2026-04-22T15:20:00.000Z',
      },
    ],
  },
  output: {
    headline: {
      status: 'risk',
      summary: '当前环境迁移仍被待审批和历史失败记录卡住。',
      nextAction: '先处理待审批 migration run，再确认阻塞 schema 是否已恢复。',
    },
    migration: {
      totalRuns: 4,
      awaitingApprovalCount: 1,
      awaitingExternalCount: 0,
      failedCount: 1,
      latestStatusLabel: 'awaiting_approval',
      summary: '4 次运行中有 1 次待审批、1 次失败，当前不适合继续推进。',
    },
    schema: {
      databaseCount: 2,
      blockedCount: 1,
      pendingCount: 0,
      summary: '2 个数据库中有 1 个处于 blocked。',
    },
    focusPoints: ['先审批迁移', '确认 blocked schema', '再继续环境变更'],
    operatorNarrative:
      '这里的核心不是看更多历史，而是先把当前阻塞的 migration run 和 schema 状态处理干净。',
  },
  assertions: [
    'headline.status 应为 risk',
    'migration.awaitingApprovalCount 应为 1',
    'schema.blockedCount 应为 1',
  ],
};
