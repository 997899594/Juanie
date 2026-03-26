export interface PresentableEnvironment {
  id?: string;
  isPreview?: boolean | null;
  previewPrNumber?: number | null;
  branch?: string | null;
  expiresAt?: Date | string | null;
  databaseStrategy?: 'direct' | 'inherit' | 'isolated_clone' | null;
  deploymentStrategy?: 'rolling' | 'controlled' | 'canary' | 'blue_green' | null;
  baseEnvironment?: {
    id: string;
    name: string;
  } | null;
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

interface PreviewDatabaseLike {
  id: string;
  name: string;
  status?: string | null;
  sourceDatabaseId?: string | null;
}

export function getEnvironmentScopeLabel(environment: PresentableEnvironment): string | null {
  if (!environment.isPreview) {
    return null;
  }

  return '预览';
}

export function getEnvironmentSourceLabel(environment: PresentableEnvironment): string | null {
  if (!environment.isPreview) {
    return null;
  }

  if (environment.previewPrNumber) {
    return `PR #${environment.previewPrNumber}`;
  }

  if (environment.branch) {
    return environment.branch;
  }

  return null;
}

export function getEnvironmentInheritancePresentation(
  environment: PresentableEnvironment
): EnvironmentInheritancePresentation | null {
  if (!environment.isPreview || !environment.baseEnvironment?.name) {
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
  if (!input.environment.isPreview || input.environment.databaseStrategy !== 'isolated_clone') {
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
  if (!value) {
    return null;
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date.toLocaleString('zh-CN', {
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
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
