import { execFile } from 'node:child_process';
import { access, mkdir, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { promisify } from 'node:util';
import { hasExecutable } from '@/lib/atlas/cli';
import {
  drizzleSchemaConfigCandidates,
  resolveSpecificationSource,
  type SchemaSource,
} from '@/lib/migrations/schema-source';
import type { ResolvedMigrationSpec } from '@/lib/migrations/types';
import {
  createProjectSourceWorkspace,
  type SourceWorkspaceContext,
} from '@/lib/repositories/source-workspace';

const execFileAsync = promisify(execFile);
const validDrizzleDialects = new Set([
  'postgresql',
  'mysql',
  'sqlite',
  'turso',
  'singlestore',
  'gel',
]);
const ansiEscapePattern = new RegExp(`${String.fromCharCode(27)}\\[[0-9;?]*[ -/]*[@-~]`, 'gu');

interface DrizzleExportOptions {
  dialect: string;
  schema: string;
}

export interface DesiredSchemaArtifact {
  source: SchemaSource;
  revision: string;
  workspaceDir: string;
  schemaSql: string;
  schemaFilePath: string;
  schemaFileUrl: string;
  sourceConfigPath: string | null;
  cleanup: () => Promise<void>;
}

interface DesiredSchemaExportInput {
  projectId: string;
  source: SchemaSource;
  revision: string;
  sourceConfigPath?: string | null;
  connectionString?: string | null;
  capabilities?: readonly string[] | null;
}

async function pathExists(pathname: string): Promise<boolean> {
  try {
    await access(pathname);
    return true;
  } catch {
    return false;
  }
}

async function runCommand(
  command: string,
  args: string[],
  options: {
    cwd?: string;
    env?: NodeJS.ProcessEnv;
  } = {}
): Promise<{ stdout: string; stderr: string }> {
  const result = await execFileAsync(command, args, {
    cwd: options.cwd,
    env: options.env,
    maxBuffer: 20 * 1024 * 1024,
  });

  return {
    stdout: result.stdout ?? '',
    stderr: result.stderr ?? '',
  };
}

function stripAnsiSequences(value: string): string {
  return value.replace(ansiEscapePattern, '');
}

export function validateDesiredSchemaSqlOutput(output: string): string {
  const schemaSql = stripAnsiSequences(output).trim();

  if (!schemaSql) {
    throw new Error('Drizzle 导出的 desired schema 为空');
  }

  const nonSqlMarkers = [
    /Interactive prompts require a TTY/i,
    /\bPulling schema from database\b/i,
    /\bReading config file\b/i,
    /\bUsing ['"][^'"]+['"] driver for database querying\b/i,
    /\bWarning\s+You are about to execute current statements\b/i,
  ];

  if (nonSqlMarkers.some((marker) => marker.test(schemaSql))) {
    throw new Error('Drizzle desired schema 导出包含交互式提示或数据库 diff 输出，已拒绝执行');
  }

  if (
    !/\b(CREATE|ALTER|DROP|COMMENT|INSERT|UPDATE|DELETE|TRUNCATE|GRANT|REVOKE|DO)\b/i.test(
      schemaSql
    )
  ) {
    throw new Error('Drizzle desired schema 导出结果不像可执行 SQL，已拒绝执行');
  }

  return schemaSql;
}

function normalizeDrizzleSchemaConfigValue(value: unknown): string {
  if (typeof value === 'string' && value.trim()) {
    return value.trim();
  }

  if (Array.isArray(value)) {
    const schemaPaths = value
      .filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
      .map((item) => item.trim());

    if (schemaPaths.length > 0) {
      return schemaPaths.join(',');
    }
  }

  throw new Error('Drizzle 配置缺少 schema，无法导出 desired schema');
}

function normalizeDrizzleDialectConfigValue(value: unknown): string {
  if (typeof value !== 'string' || !validDrizzleDialects.has(value)) {
    throw new Error('Drizzle 配置缺少有效 dialect，无法导出 desired schema');
  }

  return value;
}

export function resolveDrizzleExportOptionsFromConfig(config: unknown): DrizzleExportOptions {
  const normalizedConfig =
    config && typeof config === 'object' && 'default' in config
      ? (config as { default: unknown }).default
      : config;

  if (!normalizedConfig || typeof normalizedConfig !== 'object') {
    throw new Error('Drizzle 配置格式无效，无法导出 desired schema');
  }

  const configRecord = normalizedConfig as Record<string, unknown>;

  return {
    dialect: normalizeDrizzleDialectConfigValue(configRecord.dialect),
    schema: normalizeDrizzleSchemaConfigValue(configRecord.schema),
  };
}

async function loadDrizzleExportOptions(input: {
  repoDir: string;
  sourceConfigPath: string;
}): Promise<DrizzleExportOptions> {
  const configPath = path.join(input.repoDir, input.sourceConfigPath);
  const configUrl = pathToFileURL(configPath);
  configUrl.searchParams.set('t', Date.now().toString(36));
  const configModule = await import(configUrl.toString());
  return resolveDrizzleExportOptionsFromConfig(configModule);
}

async function createSourceWorkspace(input: {
  projectId: string;
  revision?: string | null;
}): Promise<SourceWorkspaceContext> {
  return createProjectSourceWorkspace({
    projectId: input.projectId,
    revision: input.revision,
    requiredCapabilities: ['read_repo'],
  });
}

async function listMatchingFilesRecursively(
  repoDir: string,
  fileNames: readonly string[]
): Promise<string[]> {
  const matches: string[] = [];

  async function walk(currentDir: string): Promise<void> {
    const entries = await readdir(currentDir, { withFileTypes: true });

    for (const entry of entries) {
      if (entry.isDirectory()) {
        if (
          ['.git', 'node_modules', '.next', '.turbo', 'dist', 'build', 'coverage'].includes(
            entry.name
          )
        ) {
          continue;
        }

        await walk(path.join(currentDir, entry.name));
        continue;
      }

      if (!entry.isFile() || !fileNames.includes(entry.name)) {
        continue;
      }

      matches.push(path.relative(repoDir, path.join(currentDir, entry.name)).replaceAll('\\', '/'));
    }
  }

  await walk(repoDir);
  return matches.sort((left, right) => left.localeCompare(right));
}

async function resolveDrizzleConfigPath(input: {
  repoDir: string;
  configuredPath?: string | null;
}): Promise<string> {
  const configuredPath = input.configuredPath?.trim();
  if (configuredPath) {
    const normalized = configuredPath.replace(/^\.\/+/u, '').replaceAll('\\', '/');
    if (await pathExists(path.join(input.repoDir, normalized))) {
      return normalized;
    }

    throw new Error(`Drizzle 配置文件不存在: ${configuredPath}`);
  }

  const discovered = await listMatchingFilesRecursively(
    input.repoDir,
    drizzleSchemaConfigCandidates
  );
  if (discovered.length === 0) {
    throw new Error(
      `未找到 Drizzle 配置文件，请在 juanie.yaml 中通过 schema.config 指定（支持: ${drizzleSchemaConfigCandidates.join(', ')}）`
    );
  }

  if (discovered.length === 1) {
    return discovered[0]!;
  }

  const rootCandidates = discovered.filter((candidate) => !candidate.includes('/'));
  if (rootCandidates.length === 1) {
    return rootCandidates[0]!;
  }

  throw new Error(
    `发现多个 Drizzle 配置文件，请在 juanie.yaml 中通过 schema.config 明确指定：${discovered.join(', ')}`
  );
}

async function hasBunLockfile(repoDir: string): Promise<boolean> {
  return (
    (await pathExists(path.join(repoDir, 'bun.lockb'))) ||
    (await pathExists(path.join(repoDir, 'bun.lock')))
  );
}

function resolveBunCommand(args: string[]): { command: string; args: string[] } {
  if (!hasExecutable('bun')) {
    throw new Error('当前运行环境缺少 bun，无法执行 Drizzle desired schema');
  }

  return {
    command: 'bun',
    args,
  };
}

async function resolveBunCommands(repoDir: string): Promise<{
  install: { command: string; args: string[] };
  execDrizzleKit: (options: DrizzleExportOptions) => { command: string; args: string[] };
}> {
  return {
    install: resolveBunCommand(
      (await hasBunLockfile(repoDir)) ? ['install', '--frozen-lockfile'] : ['install']
    ),
    execDrizzleKit: (options) =>
      resolveBunCommand([
        'x',
        'drizzle-kit',
        'export',
        '--dialect',
        options.dialect,
        '--schema',
        options.schema,
      ]),
  };
}

function buildSchemaExportEnv(connectionString?: string | null): NodeJS.ProcessEnv {
  const normalizedConnectionString = connectionString?.trim();

  return {
    ...process.env,
    CI: 'true',
    DATABASE_URL: normalizedConnectionString ?? process.env.DATABASE_URL,
    DB_URL: normalizedConnectionString ?? process.env.DB_URL,
    POSTGRES_URL: normalizedConnectionString ?? process.env.POSTGRES_URL,
    POSTGRESQL_URL: normalizedConnectionString ?? process.env.POSTGRESQL_URL,
    MYSQL_URL: normalizedConnectionString ?? process.env.MYSQL_URL,
  };
}

async function exportDrizzleDesiredSchema(input: {
  sourceConfigPath?: string | null;
  connectionString?: string | null;
  capabilities?: readonly string[] | null;
  workspace: SourceWorkspaceContext;
}): Promise<Omit<DesiredSchemaArtifact, 'source' | 'revision' | 'workspaceDir' | 'cleanup'>> {
  const sourceConfigPath = await resolveDrizzleConfigPath({
    repoDir: input.workspace.repoDir,
    configuredPath: input.sourceConfigPath,
  });
  const commands = await resolveBunCommands(input.workspace.repoDir);
  const env = buildSchemaExportEnv(input.connectionString);

  await runCommand(commands.install.command, commands.install.args, {
    cwd: input.workspace.repoDir,
    env,
  });

  const exportOptions = await loadDrizzleExportOptions({
    repoDir: input.workspace.repoDir,
    sourceConfigPath,
  });
  const drizzleExport = commands.execDrizzleKit(exportOptions);
  const { stdout } = await runCommand(drizzleExport.command, drizzleExport.args, {
    cwd: input.workspace.repoDir,
    env,
  });
  const schemaSql = validateDesiredSchemaSqlOutput(stdout);

  const schemaDir = path.join(input.workspace.tempRoot, '.juanie', 'desired-schema');
  const schemaFilePath = path.join(schemaDir, 'schema.sql');
  await mkdir(schemaDir, { recursive: true });
  await writeFile(schemaFilePath, `${schemaSql}\n`, 'utf8');

  return {
    schemaSql,
    schemaFilePath,
    schemaFileUrl: pathToFileURL(schemaFilePath).toString(),
    sourceConfigPath,
  };
}

export async function exportDesiredSchemaFromRepository(
  input: DesiredSchemaExportInput
): Promise<DesiredSchemaArtifact> {
  const workspace = await createSourceWorkspace({
    projectId: input.projectId,
    revision: input.revision,
  });

  try {
    if (input.source !== 'drizzle') {
      throw new Error(`当前仅支持从 ${input.source} 导出 desired schema`);
    }

    const result = await exportDrizzleDesiredSchema({
      sourceConfigPath: input.sourceConfigPath,
      connectionString: input.connectionString,
      capabilities: input.capabilities,
      workspace,
    });

    return {
      source: input.source,
      revision: workspace.revision,
      workspaceDir: workspace.repoDir,
      cleanup: workspace.cleanup,
      ...result,
    };
  } catch (error) {
    await workspace.cleanup();
    throw error;
  }
}

export async function exportDesiredSchemaForSpec(
  spec: ResolvedMigrationSpec,
  revision: string
): Promise<DesiredSchemaArtifact> {
  const source = resolveSpecificationSource(spec.specification);
  return exportDesiredSchemaFromRepository({
    projectId: spec.specification.projectId,
    source,
    revision,
    sourceConfigPath: spec.specification.sourceConfigPath,
    connectionString: spec.database.connectionString,
    capabilities: spec.database.capabilities,
  });
}
