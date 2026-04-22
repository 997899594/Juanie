import type { JuanieEvalFixture } from '@/lib/ai/evals/types';
import type { IncidentEvidencePack } from '@/lib/ai/evidence/incident-evidence';
import type { IncidentAnalysis } from '@/lib/ai/schemas/incident-analysis';

export const incidentAnalysisEvalFixture: JuanieEvalFixture<
  IncidentEvidencePack,
  IncidentAnalysis
> = {
  id: 'incident-analysis-migration-blocked',
  promptKey: 'incident-analysis',
  promptVersion: 'v1',
  pluginId: 'incident-intelligence',
  skillId: 'incident-skill',
  scope: 'release',
  scenario: '发布失败由迁移阻塞引起，部署本身未真正开始接管流量。',
  inputSummary:
    'release degraded，migration run awaiting_approval，deployment 尚未成功完成 rollout，治理要求先处理迁移。',
  input: {
    releaseId: 'rel_prod_001',
    projectId: 'proj_alpha',
    teamId: 'team_alpha',
    environmentId: 'env_prod',
    environmentName: 'Production',
    releaseStatus: 'degraded',
    errorMessage: 'Migration approval is pending.',
    issueSummary: '迁移审批未完成，发布阻塞。',
    primaryIssue: '迁移审批未完成导致 release 无法继续。',
    timeline: [
      {
        at: '2026-04-22T16:00:00.000Z',
        type: 'migration',
        title: 'migration queued for approval',
        summary: '迁移进入 awaiting_approval。',
        tone: 'warning',
      },
      {
        at: '2026-04-22T16:03:00.000Z',
        type: 'release',
        title: 'release marked degraded',
        summary: '发布被标记为 degraded，等待人工处理。',
        tone: 'danger',
      },
    ],
    safeActions: [],
  },
  output: {
    diagnosis: {
      rootCause: '数据库迁移处于待审批状态，导致本次发布在进入放量前被阻塞。',
      category: 'migration_blocked',
      confidence: 'high',
      summary: '当前故障主因是迁移审批未完成，而不是运行时探针故障。',
    },
    causalChain: [
      {
        at: '2026-04-22T16:00:00.000Z',
        event: 'migration queued for approval',
        impact: '发布流程停在迁移审批阶段，后续 rollout 未继续。',
      },
      {
        at: '2026-04-22T16:03:00.000Z',
        event: 'release marked degraded',
        impact: '交付状态降级，等待人工处理迁移任务。',
      },
    ],
    evidence: [
      {
        source: 'migration',
        summary: '最新 migration run 状态为 awaiting_approval。',
      },
      {
        source: 'governance',
        summary: '当前环境策略要求先审批迁移再继续执行。',
      },
    ],
    actions: {
      safe: [],
      manual: [
        {
          label: '审批迁移',
          summary: '先在任务中心完成迁移审批，再重新检查 release 状态。',
        },
      ],
    },
    operatorNarrative: '这次不是服务先坏了，而是交付链路被迁移审批卡住了。',
  },
  assertions: [
    'diagnosis.category 应为 migration_blocked',
    'diagnosis.confidence 应为 high',
    'manual actions 应包含审批迁移',
  ],
};
