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
  execDrizzleKit: (configPath: string) => { command: string; args: string[] };
}> {
  return {
    install: resolveBunCommand(
      (await hasBunLockfile(repoDir)) ? ['install', '--frozen-lockfile'] : ['install']
    ),
    execDrizzleKit: (configPath) =>
      resolveBunCommand(['x', 'drizzle-kit', 'export', '--config', configPath]),
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

  const drizzleExport = commands.execDrizzleKit(sourceConfigPath);
  const { stdout } = await runCommand(drizzleExport.command, drizzleExport.args, {
    cwd: input.workspace.repoDir,
    env,
  });
  const schemaSql = stdout.trim();

  if (!schemaSql) {
    throw new Error('Drizzle 导出的 desired schema 为空');
  }

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
  });
}
