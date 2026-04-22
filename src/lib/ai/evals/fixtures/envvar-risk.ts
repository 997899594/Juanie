import type { JuanieEvalFixture } from '@/lib/ai/evals/types';
import type { EnvironmentEnvvarRiskEvidence } from '@/lib/ai/evidence/environment-envvar-risk';
import type { EnvvarRisk } from '@/lib/ai/schemas/envvar-risk';

export const envvarRiskEvalFixture: JuanieEvalFixture<EnvironmentEnvvarRiskEvidence, EnvvarRisk> = {
  id: 'envvar-risk-inherited-overrides',
  promptKey: 'envvar-risk',
  promptVersion: 'v1',
  pluginId: 'envvar-risk',
  skillId: 'envvar-skill',
  scope: 'environment',
  scenario: '环境变量存在较多继承和服务覆盖，用户需要先理解覆盖复杂度。',
  inputSummary: '12 个生效变量，4 个继承，2 组服务覆盖，6 个密文变量。',
  input: {
    teamId: 'team_alpha',
    projectId: 'proj_alpha',
    projectName: 'Alpha',
    environmentId: 'env_prod',
    environmentName: 'Production',
    latestReleaseTitle: 'Release #128',
    variables: {
      directCount: 8,
      effectiveCount: 12,
      inheritedCount: 4,
      secretCount: 6,
      serviceOverrideGroupCount: 2,
      serviceOverrideVariableCount: 3,
      summary: '12 个生效变量 · 4 个继承 · 6 个密文 · 2 组服务覆盖',
    },
    examples: {
      inheritedKeys: ['REDIS_URL', 'SENTRY_DSN'],
      serviceOverrideKeys: ['API_BASE_URL', 'QUEUE_CONCURRENCY'],
      directKeys: ['DATABASE_URL', 'APP_URL'],
    },
  },
  output: {
    headline: {
      status: 'attention',
      summary: '变量整体可用，但继承链和服务覆盖已经有一定复杂度。',
      nextAction: '先检查服务覆盖变量是否仍然必要，再确认关键密文来源清晰。',
    },
    coverage: {
      directCount: 8,
      effectiveCount: 12,
      inheritedCount: 4,
      secretCount: 6,
      serviceOverrideGroupCount: 2,
      summary: '12 个生效变量，其中 4 个继承，6 个密文，2 组服务覆盖。',
    },
    risks: ['服务覆盖较多', '继承链需要保持清晰', '关键密文应确认来源'],
    operatorNarrative: '这块最大的风险不是变量数量，而是覆盖关系逐渐变复杂，最好优先做减法。',
  },
  assertions: [
    'headline.status 应为 attention',
    'coverage.inheritedCount 应为 4',
    'risks 应指出覆盖和继承复杂度',
  ],
};
