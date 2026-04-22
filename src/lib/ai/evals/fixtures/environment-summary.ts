import type { JuanieEvalFixture } from '@/lib/ai/evals/types';
import type { EnvironmentEvidencePack } from '@/lib/ai/evidence/environment-evidence';
import type { EnvironmentSummary } from '@/lib/ai/schemas/environment-summary';

export const environmentSummaryEvalFixture: JuanieEvalFixture<
  EnvironmentEvidencePack,
  EnvironmentSummary
> = {
  id: 'environment-summary-production-attention',
  promptKey: 'environment-summary',
  promptVersion: 'v1',
  pluginId: 'environment-summary',
  skillId: 'environment-skill',
  scope: 'environment',
  scenario: '正式环境可访问，但数据库存在待处理项，用户需要先看地址和当前版本。',
  inputSummary:
    'production 环境，主域名可访问，最新版本已发布，数据库有 1 个待处理项，变量已稳定生效。',
  input: {
    teamId: 'team_alpha',
    projectId: 'proj_alpha',
    projectName: 'Alpha',
    environmentId: 'env_prod',
    environmentName: 'Production',
    kind: 'production',
    primaryDomainUrl: 'https://alpha.juanie.art',
    domains: ['alpha.juanie.art', 'www.alpha.juanie.art'],
    scopeLabel: '正式环境',
    sourceLabel: '跟随 main 分支',
    strategyLabel: 'Controlled',
    databaseStrategyLabel: 'Direct',
    issueSummary: '1 个数据库仍有待处理 schema 变更。',
    nextAction: '先检查待处理迁移，再继续发布。',
    gitSummary: 'main · 9c1a7d2',
    latestRelease: {
      title: 'Release #128',
      shortCommitSha: '9c1a7d2',
      createdAtLabel: '2 分钟前',
      statusLabel: '已发布',
    },
    previewLifecycle: null,
    cleanupState: null,
    databases: {
      directCount: 2,
      effectiveCount: 2,
      inheritedCount: 0,
      summary: '2 个数据库，1 个待处理',
      blockedCount: 0,
      pendingCount: 1,
    },
    variables: {
      directCount: 8,
      effectiveCount: 12,
      inheritedCount: 4,
      serviceOverrideCount: 1,
      summary: '12 个生效变量，4 个继承，1 组服务覆盖',
    },
    recentActivity: [
      {
        kind: '发布',
        title: 'Release #128',
        summary: '最新版本已推送到正式环境。',
        createdAtLabel: '2 分钟前',
      },
    ],
  },
  output: {
    headline: {
      status: 'attention',
      summary: '正式环境当前可访问，但还有 1 个数据库待处理项需要跟进。',
      nextAction: '先检查待处理迁移，再决定是否继续后续变更。',
    },
    access: {
      primaryUrl: 'https://alpha.juanie.art',
      domains: ['alpha.juanie.art', 'www.alpha.juanie.art'],
    },
    sourceOfTruth: {
      scopeLabel: '正式环境',
      sourceLabel: '跟随 main 分支',
      gitSummary: 'main · 9c1a7d2',
    },
    currentVersion: {
      title: 'Release #128',
      shortCommitSha: '9c1a7d2',
      createdAtLabel: '2 分钟前',
      statusLabel: '已发布',
    },
    resources: {
      databaseSummary: '2 个数据库，1 个待处理',
      variableSummary: '12 个生效变量，4 个继承，1 组服务覆盖',
    },
    lifecycle: {
      deploymentStrategy: 'Controlled',
      databaseStrategy: 'Direct',
      cleanupSummary: null,
      previewSummary: null,
    },
    focusPoints: ['先看访问地址', '确认当前版本', '处理待处理迁移'],
    operatorNarrative:
      '这个环境的主线很清楚：地址可用，版本清晰，当前唯一需要优先盯的是数据库待处理项。',
  },
  assertions: [
    'headline.status 应为 attention',
    'access.primaryUrl 应暴露正式环境地址',
    'resources.databaseSummary 应突出待处理数据库状态',
  ],
};
