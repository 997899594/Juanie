import { loadAIEnvironmentContext } from '@/lib/ai/context/environment-context';

export interface EnvironmentEvidencePack {
  teamId: string;
  projectId: string;
  projectName: string;
  environmentId: string;
  environmentName: string;
  kind: 'production' | 'persistent' | 'preview' | null;
  primaryDomainUrl: string | null;
  domains: string[];
  scopeLabel: string | null;
  sourceLabel: string | null;
  strategyLabel: string | null;
  databaseStrategyLabel: string | null;
  issueSummary: string | null;
  nextAction: string | null;
  gitSummary: string | null;
  latestRelease: {
    title: string | null;
    shortCommitSha: string | null;
    createdAtLabel: string | null;
    statusLabel: string | null;
  } | null;
  previewLifecycle: {
    stateLabel: string;
    summary: string | null;
    nextActionLabel: string;
  } | null;
  cleanupState: {
    label: string;
    summary: string;
  } | null;
  databases: {
    directCount: number;
    effectiveCount: number;
    inheritedCount: number;
    summary: string;
    blockedCount: number;
    pendingCount: number;
  };
  variables: {
    directCount: number;
    effectiveCount: number;
    inheritedCount: number;
    serviceOverrideCount: number;
    summary: string;
  };
  recentActivity: Array<{
    kind: string;
    title: string;
    summary: string;
    createdAtLabel: string | null;
  }>;
}

function buildDatabaseSummary(input: {
  directCount: number;
  effectiveCount: number;
  inheritedCount: number;
  blockedCount: number;
  pendingCount: number;
}): string {
  const parts = [`${input.effectiveCount} 个数据库`];

  if (input.inheritedCount > 0) {
    parts.push(`${input.inheritedCount} 个继承`);
  }

  if (input.blockedCount > 0) {
    parts.push(`${input.blockedCount} 个阻塞`);
  } else if (input.pendingCount > 0) {
    parts.push(`${input.pendingCount} 个待处理`);
  } else if (input.directCount > 0) {
    parts.push('状态稳定');
  }

  return parts.join('，');
}

function buildVariableSummary(input: {
  directCount: number;
  effectiveCount: number;
  inheritedCount: number;
  serviceOverrideCount: number;
}): string {
  const parts = [`${input.effectiveCount} 个生效变量`];

  if (input.inheritedCount > 0) {
    parts.push(`${input.inheritedCount} 个继承`);
  }

  if (input.serviceOverrideCount > 0) {
    parts.push(`${input.serviceOverrideCount} 组服务覆盖`);
  } else if (input.directCount > 0) {
    parts.push('当前环境已配置');
  }

  return parts.join('，');
}

export async function buildEnvironmentEvidencePack(input: {
  projectId: string;
  environmentId: string;
}): Promise<EnvironmentEvidencePack> {
  const { teamId, projectName, environment, variableOverview } =
    await loadAIEnvironmentContext(input);
  const blockedDatabaseCount = environment.databases.filter(
    (database) =>
      database.schemaState?.status === 'blocked' || database.latestRepairPlan?.riskLevel === 'high'
  ).length;
  const pendingDatabaseCount = environment.databases.filter((database) =>
    database.schemaState
      ? database.schemaState.status === 'pending_migrations' ||
        database.schemaState.status === 'drifted'
      : false
  ).length;
  const inheritedVariableCount = variableOverview.effective.filter(
    (variable) => variable.inherited
  ).length;

  return {
    teamId,
    projectId: input.projectId,
    projectName,
    environmentId: environment.id,
    environmentName: environment.name,
    kind: environment.kind ?? null,
    primaryDomainUrl: environment.primaryDomainUrl,
    domains: environment.domains.map((domain) => domain.hostname),
    scopeLabel: environment.scopeLabel,
    sourceLabel: environment.sourceLabel,
    strategyLabel: environment.strategyLabel,
    databaseStrategyLabel: environment.databaseStrategyLabel,
    issueSummary: environment.platformSignals.primarySummary,
    nextAction: environment.platformSignals.nextActionLabel,
    gitSummary: environment.gitTracking?.summary ?? null,
    latestRelease: environment.latestReleaseCard
      ? {
          title: environment.latestReleaseCard.title,
          shortCommitSha: environment.latestReleaseCard.shortCommitSha,
          createdAtLabel: environment.latestReleaseCard.createdAtLabel,
          statusLabel: environment.latestReleaseCard.statusDecoration.label,
        }
      : null,
    previewLifecycle: environment.previewLifecycle,
    cleanupState: environment.cleanupState
      ? {
          label: environment.cleanupState.label,
          summary: environment.cleanupState.summary,
        }
      : null,
    databases: {
      directCount: environment.databaseBindingSummary.directCount,
      effectiveCount: environment.databaseBindingSummary.effectiveCount,
      inheritedCount: environment.databaseBindingSummary.inheritedCount,
      summary: buildDatabaseSummary({
        directCount: environment.databaseBindingSummary.directCount,
        effectiveCount: environment.databaseBindingSummary.effectiveCount,
        inheritedCount: environment.databaseBindingSummary.inheritedCount,
        blockedCount: blockedDatabaseCount,
        pendingCount: pendingDatabaseCount,
      }),
      blockedCount: blockedDatabaseCount,
      pendingCount: pendingDatabaseCount,
    },
    variables: {
      directCount: variableOverview.direct.length,
      effectiveCount: variableOverview.effective.length,
      inheritedCount: inheritedVariableCount,
      serviceOverrideCount: variableOverview.serviceOverrides.length,
      summary: buildVariableSummary({
        directCount: variableOverview.direct.length,
        effectiveCount: variableOverview.effective.length,
        inheritedCount: inheritedVariableCount,
        serviceOverrideCount: variableOverview.serviceOverrides.length,
      }),
    },
    recentActivity: environment.recentActivity.slice(0, 4).map((item) => ({
      kind: item.kindLabel,
      title: item.title,
      summary: item.summary,
      createdAtLabel: item.createdAtLabel,
    })),
  };
}
