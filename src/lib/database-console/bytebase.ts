export type DatabaseConsoleProvider = 'bytebase';

export interface DatabaseConsoleConfig {
  enabled: boolean;
  provider: DatabaseConsoleProvider;
  label: string;
  workspaceUrl: string | null;
  sqlEditorUrl: string | null;
  databaseUrlTemplate: string | null;
  accessModeLabel: string;
  summary: string;
  changeManagementSummary: string;
}

export interface DatabaseConsoleLink {
  enabled: true;
  provider: DatabaseConsoleProvider;
  label: string;
  workspaceUrl: string;
  sqlEditorUrl: string;
  databaseUrl: string;
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
  workspaceUrl: string | null;
  sqlEditorUrl: string | null;
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

const DEFAULT_SQL_EDITOR_PATH = '/sql-editor';
const DEFAULT_ACCESS_MODE_LABEL = '只读优先';
const DEFAULT_SUMMARY = '用于查询、排障和浏览结构；发布迁移仍走 Juanie + Atlas 主链';
const DEFAULT_CHANGE_MANAGEMENT_SUMMARY =
  'DDL/DML 不在控制台直接放行，结构变更回到发布、提升或修复流程';

function parseBoolean(value: string | undefined): boolean | null {
  if (value === undefined || value.trim() === '') {
    return null;
  }

  return ['1', 'true', 'yes', 'on'].includes(value.trim().toLowerCase());
}

function normalizeBaseUrl(value: string | undefined): string | null {
  const trimmed = value?.trim();
  if (!trimmed) {
    return null;
  }

  return trimmed.replace(/\/+$/, '');
}

function joinUrl(baseUrl: string, pathOrUrl: string | undefined): string {
  const value = pathOrUrl?.trim() || DEFAULT_SQL_EDITOR_PATH;
  if (/^https?:\/\//i.test(value)) {
    return value.replace(/\/+$/, '');
  }

  return `${baseUrl}/${value.replace(/^\/+/, '')}`;
}

function encodeTemplateValue(value: string | number | null | undefined): string {
  return encodeURIComponent(value === null || value === undefined ? '' : String(value));
}

function expandDatabaseUrlTemplate(
  template: string,
  input: {
    project: DatabaseConsoleProjectInput;
    environment: DatabaseConsoleEnvironmentInput;
    database: DatabaseConsoleDatabaseInput;
    sqlEditorUrl: string;
    workspaceUrl: string;
  }
): string {
  const values: Record<string, string | number | null | undefined> = {
    workspaceUrl: input.workspaceUrl,
    sqlEditorUrl: input.sqlEditorUrl,
    projectId: input.project.id,
    projectName: input.project.name,
    environmentId: input.environment.id,
    environmentName: input.environment.name,
    databaseId: input.database.id,
    databaseName: input.database.databaseName ?? input.database.name,
    databaseLabel: input.database.name,
    databaseType: input.database.type,
    host: input.database.host,
    port: input.database.port,
    namespace: input.database.namespace,
    serviceName: input.database.serviceName,
  };

  return template.replace(/\{([a-zA-Z0-9_]+)\}/g, (_, key: string) =>
    key === 'workspaceUrl' || key === 'sqlEditorUrl'
      ? String(values[key] ?? '')
      : encodeTemplateValue(values[key])
  );
}

export function getBytebaseConsoleConfig(
  env: Record<string, string | undefined> = process.env
): DatabaseConsoleConfig {
  const workspaceUrl = normalizeBaseUrl(env.BYTEBASE_URL ?? env.BYTEBASE_PUBLIC_URL);
  const explicitEnabled = parseBoolean(env.BYTEBASE_ENABLED);
  const enabled = explicitEnabled ?? Boolean(workspaceUrl);

  if (!enabled || !workspaceUrl) {
    return {
      enabled: false,
      provider: 'bytebase',
      label: 'Bytebase',
      workspaceUrl: null,
      sqlEditorUrl: null,
      databaseUrlTemplate: null,
      accessModeLabel: DEFAULT_ACCESS_MODE_LABEL,
      summary: DEFAULT_SUMMARY,
      changeManagementSummary: DEFAULT_CHANGE_MANAGEMENT_SUMMARY,
    };
  }

  return {
    enabled: true,
    provider: 'bytebase',
    label: env.BYTEBASE_LABEL?.trim() || 'Bytebase',
    workspaceUrl,
    sqlEditorUrl: joinUrl(
      workspaceUrl,
      env.BYTEBASE_SQL_EDITOR_URL ?? env.BYTEBASE_SQL_EDITOR_PATH
    ),
    databaseUrlTemplate: env.BYTEBASE_DATABASE_URL_TEMPLATE?.trim() || null,
    accessModeLabel: env.BYTEBASE_ACCESS_MODE_LABEL?.trim() || DEFAULT_ACCESS_MODE_LABEL,
    summary: env.BYTEBASE_SUMMARY?.trim() || DEFAULT_SUMMARY,
    changeManagementSummary:
      env.BYTEBASE_CHANGE_MANAGEMENT_SUMMARY?.trim() || DEFAULT_CHANGE_MANAGEMENT_SUMMARY,
  };
}

export function buildDatabaseConsoleOverview(
  config: DatabaseConsoleConfig
): DatabaseConsoleOverview {
  return {
    enabled: config.enabled,
    provider: config.provider,
    label: config.label,
    workspaceUrl: config.workspaceUrl,
    sqlEditorUrl: config.sqlEditorUrl,
    accessModeLabel: config.accessModeLabel,
    summary: config.summary,
    changeManagementSummary: config.changeManagementSummary,
  };
}

export function buildBytebaseDatabaseConsoleLink(input: {
  config: DatabaseConsoleConfig;
  project: DatabaseConsoleProjectInput;
  environment: DatabaseConsoleEnvironmentInput;
  database: DatabaseConsoleDatabaseInput;
}): DatabaseConsoleLink | null {
  if (!input.config.enabled || !input.config.workspaceUrl || !input.config.sqlEditorUrl) {
    return null;
  }

  const databaseUrl = input.config.databaseUrlTemplate
    ? expandDatabaseUrlTemplate(input.config.databaseUrlTemplate, {
        project: input.project,
        environment: input.environment,
        database: input.database,
        sqlEditorUrl: input.config.sqlEditorUrl,
        workspaceUrl: input.config.workspaceUrl,
      })
    : input.config.sqlEditorUrl;

  return {
    enabled: true,
    provider: input.config.provider,
    label: input.config.label,
    workspaceUrl: input.config.workspaceUrl,
    sqlEditorUrl: input.config.sqlEditorUrl,
    databaseUrl,
    accessModeLabel: input.config.accessModeLabel,
    summary: input.config.summary,
    changeManagementSummary: input.config.changeManagementSummary,
    context: {
      engine: input.database.type,
      target: input.database.databaseName ?? input.database.name,
      namespace: input.database.namespace ?? null,
      serviceName: input.database.serviceName ?? null,
      host: input.database.host ?? null,
      port: input.database.port ?? null,
      databaseName: input.database.databaseName ?? null,
    },
  };
}
