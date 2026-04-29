type RuntimeStateName = 'running' | 'sleeping' | 'partial' | 'not_deployed' | 'unknown';

interface EnvironmentClientViewRecord {
  kind?: 'production' | 'persistent' | 'preview' | null;
  namespace: string | null;
  isProduction: boolean | null;
  branch: string | null;
  isPreview: boolean | null;
  databases: Array<{
    schemaState: {
      status:
        | 'aligned'
        | 'pending_migrations'
        | 'aligned_untracked'
        | 'drifted'
        | 'unmanaged'
        | 'blocked';
    } | null;
  }>;
  databaseBindingSummary: {
    inheritedCount: number;
  };
  policy: {
    primarySignal: {
      summary: string;
    } | null;
  };
  platformSignals: {
    primarySummary: string | null;
  };
  scopeLabel: string | null;
  sourceLabel: string | null;
  expiryLabel: string | null;
  primaryDomainUrl: string | null;
  previewLifecycle: {
    summary: string | null;
  } | null;
  latestReleaseCard: {
    title: string;
    shortCommitSha: string | null;
    createdAtLabel: string | null;
  } | null;
  sourceBuild: {
    label: string;
    summary: string;
    nextActionLabel: string;
  } | null;
  gitTracking: {
    summary: string;
  } | null;
  cleanupState: {
    summary: string;
  } | null;
  runtimeState: {
    state: RuntimeStateName;
    summary: string;
  } | null;
}

export function getEnvironmentPriority(environment: EnvironmentClientViewRecord): number {
  switch (environment.kind) {
    case 'production':
      return 0;
    case 'persistent':
      return 1;
    case 'preview':
      return 2;
    default:
      if (environment.isProduction) {
        return 0;
      }

      return environment.isPreview ? 2 : 1;
  }
}

export function buildEnvironmentHeaderMeta(environment: EnvironmentClientViewRecord): string {
  return [
    [environment.scopeLabel, environment.sourceLabel].filter(Boolean).join(' · ') || null,
    environment.expiryLabel,
  ]
    .filter(Boolean)
    .join(' · ');
}

export function buildEnvironmentStatusSummary(environment: EnvironmentClientViewRecord): string {
  if (environment.runtimeState?.state === 'sleeping') {
    return environment.runtimeState.summary;
  }

  if (environment.policy.primarySignal?.summary) {
    return environment.policy.primarySignal.summary;
  }

  if (environment.previewLifecycle?.summary) {
    return environment.previewLifecycle.summary;
  }

  if (environment.platformSignals.primarySummary) {
    return environment.platformSignals.primarySummary;
  }

  if (environment.cleanupState?.summary) {
    return environment.cleanupState.summary;
  }

  if (environment.namespace) {
    return '运行正常';
  }

  return '状态更新中';
}

export function buildRuntimeStateLabel(
  runtimeState: EnvironmentClientViewRecord['runtimeState']
): string {
  switch (runtimeState?.state) {
    case 'running':
      return '运行中';
    case 'sleeping':
      return '已休眠';
    case 'partial':
      return '唤醒中';
    case 'not_deployed':
      return '未部署';
    case 'unknown':
      return '未知';
    default:
      return '未连接';
  }
}

export function getRuntimeAction(
  environment: EnvironmentClientViewRecord
): 'sleep' | 'wake' | null {
  if (environment.isProduction) {
    return null;
  }

  switch (environment.runtimeState?.state) {
    case 'running':
    case 'partial':
      return 'sleep';
    case 'sleeping':
      return 'wake';
    default:
      return null;
  }
}

export function buildEnvironmentListSummary(environment: EnvironmentClientViewRecord): string {
  if (environment.primaryDomainUrl) {
    return environment.primaryDomainUrl.replace(/^https?:\/\//, '');
  }

  return buildEnvironmentStatusSummary(environment);
}

export function buildEnvironmentSourceSummary(environment: EnvironmentClientViewRecord): {
  label: string;
  summary: string;
} {
  if (environment.sourceBuild) {
    return {
      label: environment.sourceBuild.label,
      summary: environment.sourceBuild.summary,
    };
  }

  if (environment.gitTracking) {
    return {
      label: environment.sourceLabel ?? '来源',
      summary: environment.gitTracking.summary,
    };
  }

  if (environment.sourceLabel) {
    return {
      label: environment.sourceLabel,
      summary:
        environment.branch && !environment.sourceLabel.includes(environment.branch)
          ? `跟随 ${environment.branch}`
          : '持续更新',
    };
  }

  return {
    label: '手动环境',
    summary: '手动发布或提升',
  };
}

export function buildEnvironmentVersionSummary(environment: EnvironmentClientViewRecord): {
  label: string;
  summary: string;
} {
  if (environment.sourceBuild && !environment.latestReleaseCard) {
    return {
      label: environment.sourceBuild.label,
      summary: environment.sourceBuild.nextActionLabel,
    };
  }

  if (!environment.latestReleaseCard) {
    return {
      label: '暂无版本',
      summary: '还没有版本',
    };
  }

  return {
    label: environment.latestReleaseCard.title,
    summary: [
      environment.latestReleaseCard.shortCommitSha
        ? `commit ${environment.latestReleaseCard.shortCommitSha}`
        : null,
      environment.latestReleaseCard.createdAtLabel,
    ]
      .filter(Boolean)
      .join(' · '),
  };
}

export function buildEnvironmentDatabaseSummary(environment: EnvironmentClientViewRecord): string {
  const totalCount = environment.databases.length;
  if (totalCount === 0) {
    return '没有数据库';
  }

  const issueCount = environment.databases.filter((database) => {
    const status = database.schemaState?.status;
    return status === 'drifted' || status === 'blocked' || status === 'pending_migrations';
  }).length;

  const inheritedCount = environment.databaseBindingSummary.inheritedCount;

  return [
    `${totalCount} 个数据库`,
    issueCount > 0 ? `${issueCount} 个需处理` : null,
    inheritedCount > 0 ? `${inheritedCount} 个继承` : null,
  ]
    .filter(Boolean)
    .join(' · ');
}
