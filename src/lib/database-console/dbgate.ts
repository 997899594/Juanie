export type DatabaseConsoleProvider = 'dbgate';

export interface DatabaseConsoleConfig {
  enabled: boolean;
  provider: DatabaseConsoleProvider;
  label: string;
  image: string;
  namespace: string;
  accessModeLabel: string;
  summary: string;
  changeManagementSummary: string;
  readonly: boolean;
  resources: {
    cpuRequest: string;
    cpuLimit: string;
    memoryRequest: string;
    memoryLimit: string;
  };
}

export interface DatabaseConsoleLink {
  enabled: true;
  provider: DatabaseConsoleProvider;
  label: string;
  consoleUrl: string;
  accessModeLabel: string;
  summary: string;
  changeManagementSummary: string;
  context: {
    engine: string;
    target: string;
    namespace: string | null;
    serviceName: string | null;
    host: string | null;
    port: number | null;
    databaseName: string | null;
  };
}

export interface DatabaseConsoleOverview {
  enabled: boolean;
  provider: DatabaseConsoleProvider;
  label: string;
  accessModeLabel: string;
  summary: string;
  changeManagementSummary: string;
}

interface DatabaseConsoleProjectInput {
  id: string;
  name: string;
}

interface DatabaseConsoleEnvironmentInput {
  id: string;
  name: string;
}

interface DatabaseConsoleDatabaseInput {
  id: string;
  name: string;
  type: string;
  host?: string | null;
  port?: number | null;
  databaseName?: string | null;
  namespace?: string | null;
  serviceName?: string | null;
}

const DEFAULT_PROVIDER = 'dbgate';
const DEFAULT_IMAGE = 'dbgate/dbgate:7.2.0';
const DEFAULT_ACCESS_MODE_LABEL = '只读优先';
const DEFAULT_SUMMARY = '用于浏览表结构、预览数据和临时查询；迁移仍走 Juanie + Atlas 主链';
const DEFAULT_CHANGE_MANAGEMENT_SUMMARY = '默认以只读工作台打开，结构变更回到发布、提升或修复流程';

function parseBoolean(value: string | undefined): boolean | null {
  if (value === undefined || value.trim() === '') {
    return null;
  }

  return ['1', 'true', 'yes', 'on'].includes(value.trim().toLowerCase());
}

function normalizeImage(value: string | undefined): string {
  return value?.trim() || DEFAULT_IMAGE;
}

function normalizeNamespace(value: string | undefined): string {
  return value?.trim() || process.env.JUANIE_NAMESPACE?.trim() || 'juanie';
}

function normalizeResource(value: string | undefined, fallback: string): string {
  return value?.trim() || fallback;
}

export function isDbGateSupportedDatabaseType(type: string): boolean {
  return type === 'postgresql' || type === 'mysql' || type === 'mongodb';
}

function getDbGateEngine(type: string): string {
  switch (type) {
    case 'postgresql':
      return 'postgres';
    case 'mysql':
      return 'mysql';
    case 'mongodb':
      return 'mongo';
    default:
      return type;
  }
}

export function getDbGateConsoleConfig(
  env: Record<string, string | undefined> = process.env
): DatabaseConsoleConfig {
  const explicitEnabled = parseBoolean(env.DATABASE_CONSOLE_ENABLED ?? env.DBGATE_ENABLED);
  const enabled = explicitEnabled ?? true;

  return {
    enabled,
    provider: DEFAULT_PROVIDER,
    label: env.DATABASE_CONSOLE_LABEL?.trim() || 'DbGate',
    image: normalizeImage(env.DBGATE_IMAGE),
    namespace: normalizeNamespace(env.DBGATE_NAMESPACE),
    accessModeLabel: env.DATABASE_CONSOLE_ACCESS_MODE_LABEL?.trim() || DEFAULT_ACCESS_MODE_LABEL,
    summary: env.DATABASE_CONSOLE_SUMMARY?.trim() || DEFAULT_SUMMARY,
    changeManagementSummary:
      env.DATABASE_CONSOLE_CHANGE_MANAGEMENT_SUMMARY?.trim() || DEFAULT_CHANGE_MANAGEMENT_SUMMARY,
    readonly: parseBoolean(env.DATABASE_CONSOLE_READONLY ?? env.DBGATE_READONLY) ?? true,
    resources: {
      cpuRequest: normalizeResource(env.DBGATE_CPU_REQUEST, '50m'),
      cpuLimit: normalizeResource(env.DBGATE_CPU_LIMIT, '500m'),
      memoryRequest: normalizeResource(env.DBGATE_MEMORY_REQUEST, '128Mi'),
      memoryLimit: normalizeResource(env.DBGATE_MEMORY_LIMIT, '512Mi'),
    },
  };
}

export function buildDatabaseConsoleOverview(
  config: DatabaseConsoleConfig
): DatabaseConsoleOverview {
  return {
    enabled: config.enabled,
    provider: config.provider,
    label: config.label,
    accessModeLabel: config.accessModeLabel,
    summary: config.summary,
    changeManagementSummary: config.changeManagementSummary,
  };
}

export function buildDbGateDatabaseConsoleLink(input: {
  config: DatabaseConsoleConfig;
  project: DatabaseConsoleProjectInput;
  environment: DatabaseConsoleEnvironmentInput;
  database: DatabaseConsoleDatabaseInput;
}): DatabaseConsoleLink | null {
  if (!input.config.enabled) {
    return null;
  }

  if (!isDbGateSupportedDatabaseType(input.database.type)) {
    return null;
  }

  return {
    enabled: true,
    provider: input.config.provider,
    label: input.config.label,
    consoleUrl: buildDbGateConsoleProxyUrl(input.project.id, input.database.id),
    accessModeLabel: input.config.accessModeLabel,
    summary: input.config.summary,
    changeManagementSummary: input.config.changeManagementSummary,
    context: {
      engine: getDbGateEngine(input.database.type),
      target: input.database.databaseName ?? input.database.name,
      namespace: input.database.namespace ?? null,
      serviceName: input.database.serviceName ?? null,
      host: input.database.host ?? null,
      port: input.database.port ?? null,
      databaseName: input.database.databaseName ?? null,
    },
  };
}

export function buildDbGateConsoleUrl(input: { projectId: string; databaseId: string }): string {
  return buildDbGateConsoleProxyUrl(input.projectId, input.databaseId);
}

export function buildDbGateConsoleProxyUrl(projectId: string, databaseId: string): string {
  return `/api/projects/${projectId}/databases/${databaseId}/console/proxy/`;
}
