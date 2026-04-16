import type { DeploymentStatus, EnvironmentDeliveryMode, EnvironmentKind } from '@/lib/db/schema';
import {
  getEnvironmentDeliveryMode,
  getEnvironmentKind,
  isPreviewEnvironment,
  isPromoteOnlyEnvironment,
} from '@/lib/environments/model';
import { formatPlatformDateTimeShort } from '@/lib/time/format';

export interface PresentableEnvironment {
  id?: string;
  kind?: EnvironmentKind | null;
  isPreview?: boolean | null;
  isProduction?: boolean | null;
  previewPrNumber?: number | null;
  branch?: string | null;
  expiresAt?: Date | string | null;
  deliveryMode?: EnvironmentDeliveryMode | null;
  databaseStrategy?: 'direct' | 'inherit' | 'isolated_clone' | null;
  deploymentStrategy?: 'rolling' | 'controlled' | 'canary' | 'blue_green' | null;
  baseEnvironment?: {
    id: string;
    name: string;
  } | null;
  deliveryRules?: Array<{
    kind: 'branch' | 'tag' | 'pull_request' | 'manual';
    pattern: string | null;
    priority?: number | null;
  }> | null;
}

export interface EnvironmentInheritancePresentation {
  key: string;
  label: string;
  summary: string;
  nextActionLabel: string;
}

export interface PreviewDatabasePresentation {
  key: string;
  label: string;
  summary: string;
  nextActionLabel: string;
  tone: 'danger' | 'neutral';
}

export interface PreviewBuildPresentation {
  key: string;
  label: string;
  summary: string;
  nextActionLabel: string;
  tone: 'danger' | 'neutral';
  status: Extract<DeploymentStatus, 'building' | 'failed'>;
  shortCommitSha: string | null;
  startedAtLabel: string | null;
}

interface PreviewDatabaseLike {
  id: string;
  name: string;
  status?: string | null;
  sourceDatabaseId?: string | null;
}

interface PreviewBuildLike {
  previewBuildStatus?: DeploymentStatus | string | null;
  previewBuildSourceCommitSha?: string | null;
  previewBuildStartedAt?: Date | string | null;
}

export function getEnvironmentScopeLabel(environment: PresentableEnvironment): string | null {
  const kind = getEnvironmentKind(environment);

  switch (kind) {
    case 'production':
      return '生产';
    case 'preview':
      return '预览';
    default:
      return '长期环境';
  }
}

export function getEnvironmentSourceLabel(environment: PresentableEnvironment): string | null {
  if (isPreviewEnvironment(environment)) {
    if (environment.previewPrNumber) {
      return `PR #${environment.previewPrNumber}`;
    }

    if (environment.branch) {
      return environment.branch;
    }
  }

  if (isPromoteOnlyEnvironment(environment)) {
    return '仅接受提升';
  }

  const rules = [...(environment.deliveryRules ?? [])].sort(
    (left, right) => (left.priority ?? 100) - (right.priority ?? 100)
  );
  const primaryRule = rules[0];

  if (!primaryRule) {
    return null;
  }

  switch (primaryRule.kind) {
    case 'branch':
      return primaryRule.pattern ? `分支 ${primaryRule.pattern}` : '分支路由';
    case 'tag':
      return primaryRule.pattern ? `标签 ${primaryRule.pattern}` : '标签路由';
    case 'pull_request':
      return 'PR 路由';
    case 'manual':
      return '手动触发';
    default:
      return null;
  }
}

export function getEnvironmentDeliveryModeLabel(
  environment: Pick<PresentableEnvironment, 'deliveryMode' | 'isProduction' | 'kind'>
): string | null {
  return getEnvironmentDeliveryMode(environment) === 'promote_only' ? '仅接受提升' : '可直接发布';
}

export function getEnvironmentInheritancePresentation(
  environment: PresentableEnvironment
): EnvironmentInheritancePresentation | null {
  if (!isPreviewEnvironment(environment) || !environment.baseEnvironment?.name) {
    return null;
  }

  return {
    key: `environment-inheritance:${environment.baseEnvironment.id}`,
    label: `继承 ${environment.baseEnvironment.name}`,
    summary: `当前环境继承 ${environment.baseEnvironment.name} 的变量与数据库配置`,
    nextActionLabel: '需要隔离时再为当前环境单独覆盖',
  };
}

export function getEnvironmentDatabaseStrategyLabel(
  strategy?: PresentableEnvironment['databaseStrategy']
): string | null {
  switch (strategy) {
    case 'inherit':
      return '继承基础数据库';
    case 'isolated_clone':
      return '独立预览库';
    case 'direct':
      return '直连数据库';
    default:
      return null;
  }
}

export function getPreviewDatabasePresentation(input: {
  environment: PresentableEnvironment & {
    databases?: PreviewDatabaseLike[] | null;
  };
}): PreviewDatabasePresentation | null {
  if (
    !isPreviewEnvironment(input.environment) ||
    input.environment.databaseStrategy !== 'isolated_clone'
  ) {
    return null;
  }

  const cloneDatabases =
    input.environment.databases?.filter((database) => !!database.sourceDatabaseId) ?? [];

  if (cloneDatabases.length === 0) {
    return {
      key: 'preview-database:pending',
      label: '预览库待创建',
      summary: '平台正在准备独立预览库资源，完成后会自动注入连接变量',
      nextActionLabel: '等待平台完成数据库准备',
      tone: 'neutral',
    };
  }

  if (cloneDatabases.some((database) => database.status === 'failed')) {
    return {
      key: 'preview-database:failed',
      label: '预览库失败',
      summary: '独立预览库创建或克隆失败，需要先排查数据库资源和集群状态',
      nextActionLabel: '检查环境和数据库状态',
      tone: 'danger',
    };
  }

  if (cloneDatabases.some((database) => ['pending', 'cloning'].includes(database.status ?? ''))) {
    return {
      key: 'preview-database:cloning',
      label: '预览库克隆中',
      summary: '平台正在克隆基础环境数据库内容，完成后预览环境会使用隔离数据',
      nextActionLabel: '等待数据库克隆完成',
      tone: 'neutral',
    };
  }

  return {
    key: 'preview-database:ready',
    label: '预览库已就绪',
    summary: `当前预览环境已就绪 ${cloneDatabases.length} 个独立数据库，与基础环境数据隔离`,
    nextActionLabel: '打开环境或继续发布验证',
    tone: 'neutral',
  };
}

export function getPreviewBuildPresentation(input: {
  environment: PresentableEnvironment & PreviewBuildLike;
}): PreviewBuildPresentation | null {
  if (!isPreviewEnvironment(input.environment)) {
    return null;
  }

  const status = input.environment.previewBuildStatus;
  if (status !== 'building' && status !== 'failed') {
    return null;
  }

  const shortCommitSha = input.environment.previewBuildSourceCommitSha?.slice(0, 7) ?? null;
  const sourceLabel = getEnvironmentSourceLabel(input.environment) ?? '当前来源';
  const startedAtLabel = formatEnvironmentTimestamp(input.environment.previewBuildStartedAt);
  const commitLabel = shortCommitSha ? `commit ${shortCommitSha}` : null;

  if (status === 'failed') {
    return {
      key: 'preview-build:failed',
      label: '预览构建失败',
      summary: [sourceLabel, commitLabel, '最近一次仓库构建没有成功进入发布链路']
        .filter(Boolean)
        .join(' · '),
      nextActionLabel: '检查仓库流水线后重新启动预览环境',
      tone: 'danger',
      status,
      shortCommitSha,
      startedAtLabel,
    };
  }

  return {
    key: 'preview-build:building',
    label: '预览构建中',
    summary: [sourceLabel, commitLabel, '平台已触发仓库构建，完成后会自动发布']
      .filter(Boolean)
      .join(' · '),
    nextActionLabel: startedAtLabel
      ? `构建启动于 ${startedAtLabel}`
      : '等待仓库流水线完成并回调 Juanie',
    tone: 'neutral',
    status,
    shortCommitSha,
    startedAtLabel,
  };
}

export function formatEnvironmentExpiry(
  expiresAt?: Date | string | null,
  now = new Date()
): string | null {
  if (!expiresAt) {
    return null;
  }

  const target = new Date(expiresAt);
  if (Number.isNaN(target.getTime())) {
    return null;
  }

  const diff = target.getTime() - now.getTime();
  if (diff <= 0) {
    return '已过期';
  }

  const hours = Math.round(diff / (1000 * 60 * 60));
  if (hours < 24) {
    return `${hours} 小时后到期`;
  }

  const days = Math.round(hours / 24);
  return `${days} 天后到期`;
}

export function formatEnvironmentTimestamp(value?: Date | string | null): string | null {
  return formatPlatformDateTimeShort(value);
}

export function getEnvironmentDeploymentStrategyLabel(
  strategy?: PresentableEnvironment['deploymentStrategy']
): string | null {
  switch (strategy) {
    case 'controlled':
      return '受控放量';
    case 'canary':
      return '金丝雀';
    case 'blue_green':
      return '蓝绿切换';
    case 'rolling':
      return '滚动发布';
    default:
      return null;
  }
}
