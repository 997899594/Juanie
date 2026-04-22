import type { JuanieEvalFixture } from '@/lib/ai/evals/types';
import type { ReleaseEvidencePack } from '@/lib/ai/evidence/release-evidence';
import type { ReleasePlan } from '@/lib/ai/schemas/release-plan';

export const releasePlanEvalFixture: JuanieEvalFixture<ReleaseEvidencePack, ReleasePlan> = {
  id: 'release-plan-production-gated-migration',
  promptKey: 'release-plan',
  promptVersion: 'v1',
  pluginId: 'release-intelligence',
  skillId: 'release-skill',
  scope: 'release',
  scenario: '生产发布包含受控迁移，需要先审批再执行放量。',
  inputSummary:
    '生产环境发布，迁移处于 awaiting_approval，部署策略为 controlled，当前平台允许创建 release 但不可直接放量。',
  input: {
    releaseId: 'rel_prod_001',
    projectId: 'proj_alpha',
    teamId: 'team_alpha',
    environmentId: 'env_prod',
    environmentName: 'Production',
    releaseStatus: 'degraded',
    displayTitle: 'Release #128',
    sourceRef: 'main',
    sourceCommitSha: '9c1a7d28b4ef',
    deploymentStrategy: 'controlled',
    databaseStrategy: 'direct',
    isProduction: true,
    isPreview: false,
    artifactCount: 3,
    migrationCount: 1,
    changedServices: ['api', 'worker'],
    hasBreakingMigration: true,
    awaitingApproval: true,
    issueSummary: '迁移审批尚未完成，发布处于受控阻塞状态。',
    nextAction: '先审批迁移，再开始受控放量。',
    capacitySummary: '集群容量充足，当前无需额外扩容。',
    timeline: [
      {
        at: '2026-04-22T15:55:00.000Z',
        type: 'release',
        title: '发布创建',
        summary: '本次生产发布已进入受控交付流程。',
        tone: 'info',
      },
      {
        at: '2026-04-22T16:00:00.000Z',
        type: 'migration',
        title: '迁移等待审批',
        summary: '数据库迁移进入 awaiting_approval。',
        tone: 'warning',
      },
      {
        at: '2026-04-22T16:02:00.000Z',
        type: 'governance',
        title: '治理阻塞放量',
        summary: '生产环境要求迁移完成后才能继续放量。',
        tone: 'warning',
      },
    ],
  },
  output: {
    recommendation: {
      strategy: 'controlled',
      confidence: 'high',
      summary: '先完成迁移审批，再按受控策略逐步放量。',
      why: ['迁移尚未完成', '当前环境策略要求受控放量'],
    },
    risk: {
      level: 'high',
      primaryRisk: '数据库迁移尚未通过审批，直接推进可能导致服务与 schema 不一致。',
      contributingRisks: ['生产环境需要审批', '放量策略不是 rolling'],
    },
    checks: [
      {
        key: 'migration',
        label: '迁移状态',
        status: 'blocked',
        summary: '存在待审批迁移，当前发布不能直接推进。',
      },
      {
        key: 'deployment-strategy',
        label: '发布方式',
        status: 'warning',
        summary: '当前环境采用 controlled，需要人工确认后继续。',
      },
    ],
    executionSteps: [
      {
        step: '审批当前迁移并确认执行结果',
        type: 'approval',
        required: true,
      },
      {
        step: '验证迁移完成后再逐步放量',
        type: 'rollout',
        required: true,
      },
    ],
    rollbackPlan: {
      summary: '若迁移后核心探针失败，回滚到上一版并暂停继续放量。',
      target: '上一稳定 release',
      triggerSignals: ['probe_failed', 'migration_blocked'],
    },
    actions: {
      canCreateRelease: true,
      canStartRollout: false,
      needsApproval: true,
    },
    operatorNarrative: '先过迁移，再推进放量，这是当前最安全的顺序。',
  },
  assertions: [
    'recommendation.strategy 应为 controlled',
    'risk.level 应为 high',
    'actions.needsApproval 应为 true',
    'executionSteps 首步应是 approval 类型',
  ],
};
