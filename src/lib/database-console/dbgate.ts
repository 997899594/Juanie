export type DatabaseConsoleProvider = 'dbgate';

export interface DatabaseConsoleConfig {
  enabled: boolean;
  provider: DatabaseConsoleProvider;
  label: string;
  image: string;
  namespace: string;
  routeNamespace: string;
  hostnameBaseDomain: string;
  gatewayServiceName: string;
  tokenTtlSeconds: number;
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
const DEFAULT_TOKEN_TTL_SECONDS = 60 * 60;
export const DBGATE_CONSOLE_HOST_PREFIX = 'dbgate-';
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

function normalizeBaseDomain(value: string | undefined): string {
  return (
    value
      ?.trim()
      .replace(/^\.+|\.+$/g, '')
      .toLowerCase() || 'juanie.art'
  );
}

function normalizeResource(value: string | undefined, fallback: string): string {
  return value?.trim() || fallback;
}

function normalizeTokenTtlSeconds(value: string | undefined): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return DEFAULT_TOKEN_TTL_SECONDS;
  }

  return Math.floor(parsed);
}

export function buildDbGateConsoleSlug(databaseId: string): string {
  const normalized = databaseId
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 52)
    .replace(/-+$/g, '');

  return normalized || 'database';
}

export function buildDbGateConsoleHostname(input: {
  databaseId: string;
  baseDomain: string;
}): string {
  return `${DBGATE_CONSOLE_HOST_PREFIX}${buildDbGateConsoleSlug(input.databaseId)}.${normalizeBaseDomain(
    input.baseDomain
  )}`;
}

export function buildDbGateConsoleUrl(input: {
  databaseId: string;
  baseDomain: string;
  token?: string;
}): string {
  const url = new URL(
    `https://${buildDbGateConsoleHostname({
      databaseId: input.databaseId,
      baseDomain: input.baseDomain,
    })}/`
  );

  if (input.token) {
    url.searchParams.set('token', input.token);
  }

  return url.toString();
}

export function parseDbGateConsoleHostname(input: {
  hostname: string;
  baseDomain: string;
}): { databaseSlug: string } | null {
  const hostname = input.hostname.trim().toLowerCase().replace(/\.$/, '');
  const baseDomain = normalizeBaseDomain(input.baseDomain);
  const suffix = `.${baseDomain}`;

  if (!hostname.endsWith(suffix)) {
    return null;
  }

  const subdomain = hostname.slice(0, -suffix.length);
  if (!subdomain.startsWith(DBGATE_CONSOLE_HOST_PREFIX)) {
    return null;
  }

  const databaseSlug = subdomain.slice(DBGATE_CONSOLE_HOST_PREFIX.length);
  if (!databaseSlug) {
    return null;
  }

  return { databaseSlug };
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
    routeNamespace:
      env.DATABASE_CONSOLE_ROUTE_NAMESPACE?.trim() ||
      env.JUANIE_NAMESPACE?.trim() ||
      process.env.JUANIE_NAMESPACE?.trim() ||
      normalizeNamespace(env.DBGATE_NAMESPACE),
    hostnameBaseDomain: normalizeBaseDomain(
      env.DBGATE_HOSTNAME_BASE_DOMAIN || env.JUANIE_BASE_DOMAIN
    ),
    gatewayServiceName: env.DATABASE_CONSOLE_GATEWAY_SERVICE_NAME?.trim() || 'juanie-web',
    tokenTtlSeconds: normalizeTokenTtlSeconds(env.DATABASE_CONSOLE_TOKEN_TTL_SECONDS),
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
    consoleUrl: buildDbGateConsoleUrl({
      databaseId: input.database.id,
      baseDomain: input.config.hostnameBaseDomain,
    }),
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
