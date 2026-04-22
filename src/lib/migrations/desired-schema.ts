import { execFile } from 'node:child_process';
import { access, mkdir, mkdtemp, readdir, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { promisify } from 'node:util';
import { eq } from 'drizzle-orm';
import { hasExecutable } from '@/lib/atlas/cli';
import { db } from '@/lib/db';
import { projects, repositories } from '@/lib/db/schema';
import { buildAuthenticatedCloneUrl } from '@/lib/git/authenticated-clone-url';
import { getTeamIntegrationSession } from '@/lib/integrations/service/integration-control-plane';
import {
  drizzleSchemaConfigCandidates,
  resolveSpecificationSource,
  type SchemaSource,
} from '@/lib/migrations/schema-source';
import type { ResolvedMigrationSpec } from '@/lib/migrations/types';

const execFileAsync = promisify(execFile);

const SOURCE_WORKSPACE_IGNORED_DIRS = new Set([
  '.git',
  'node_modules',
  '.next',
  '.turbo',
  'dist',
  'build',
  'coverage',
]);

interface SourceWorkspaceContext {
  tempRoot: string;
  repoDir: string;
  revision: string;
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

async function getRepositorySourceContext(projectId: string): Promise<{
  fullName: string;
  cloneUrl: string | null;
  defaultBranch: string;
  provider: 'github' | 'gitlab' | 'gitlab-self-hosted';
  accessToken: string;
  serverUrl: string | null;
}> {
  const project = await db.query.projects.findFirst({
    where: eq(projects.id, projectId),
  });

  if (!project?.repositoryId) {
    throw new Error('项目缺少仓库绑定，无法导出 desired schema');
  }

  const repository = await db.query.repositories.findFirst({
    where: eq(repositories.id, project.repositoryId),
  });

  if (!repository) {
    throw new Error('仓库不存在，无法导出 desired schema');
  }

  const session = await getTeamIntegrationSession({
    teamId: project.teamId,
    requiredCapabilities: ['read_repo'],
  });

  return {
    fullName: repository.fullName,
    cloneUrl: repository.cloneUrl ?? null,
    defaultBranch: repository.defaultBranch || 'main',
    provider: session.provider,
    accessToken: session.accessToken,
    serverUrl: session.serverUrl,
  };
}

async function createSourceWorkspace(input: {
  projectId: string;
  revision?: string | null;
}): Promise<SourceWorkspaceContext> {
  const repository = await getRepositorySourceContext(input.projectId);
  const requestedRevision = input.revision?.trim() || repository.defaultBranch;
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), 'juanie-source-schema-'));
  const repoDir = path.join(tempRoot, 'repo');
  await mkdir(repoDir, { recursive: true });

  const cloneUrl = buildAuthenticatedCloneUrl({
    cloneUrl: repository.cloneUrl,
    fullName: repository.fullName,
    provider: repository.provider,
    accessToken: repository.accessToken,
    serverUrl: repository.serverUrl,
  });

  await runCommand('git', ['init'], { cwd: repoDir });
  await runCommand('git', ['remote', 'add', 'origin', cloneUrl], { cwd: repoDir });
  await runCommand('git', ['fetch', '--depth', '1', 'origin', requestedRevision], { cwd: repoDir });
  await runCommand('git', ['checkout', '--detach', 'FETCH_HEAD'], { cwd: repoDir });
  const resolvedRevision = (
    await runCommand('git', ['rev-parse', 'HEAD'], { cwd: repoDir })
  ).stdout.trim();

  return {
    tempRoot,
    repoDir,
    revision: resolvedRevision || requestedRevision,
  };
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
        if (SOURCE_WORKSPACE_IGNORED_DIRS.has(entry.name)) {
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

interface DetectedPackageManager {
  name: 'bun' | 'pnpm' | 'yarn' | 'npm';
  hasLockfile: boolean;
}

async function detectPackageManager(repoDir: string): Promise<DetectedPackageManager> {
  if (
    (await pathExists(path.join(repoDir, 'bun.lockb'))) ||
    (await pathExists(path.join(repoDir, 'bun.lock')))
  ) {
    return { name: 'bun', hasLockfile: true };
  }

  if (await pathExists(path.join(repoDir, 'pnpm-lock.yaml'))) {
    return { name: 'pnpm', hasLockfile: true };
  }

  if (await pathExists(path.join(repoDir, 'yarn.lock'))) {
    return { name: 'yarn', hasLockfile: true };
  }

  return {
    name: 'npm',
    hasLockfile: await pathExists(path.join(repoDir, 'package-lock.json')),
  };
}

function resolveCommandWithFallback(
  primary: { command: string; args: string[] },
  fallback?: { command: string; args: string[] }
): { command: string; args: string[] } {
  if (hasExecutable(primary.command)) {
    return primary;
  }

  if (fallback && hasExecutable(fallback.command)) {
    return fallback;
  }

  const attempted = [primary.command, fallback?.command].filter(Boolean).join(' / ');
  throw new Error(`当前运行环境缺少必需命令：${attempted}`);
}

function resolvePackageManagerCommands(packageManager: DetectedPackageManager): {
  install: { command: string; args: string[] };
  execDrizzleKit: (configPath: string) => { command: string; args: string[] };
} {
  switch (packageManager.name) {
    case 'bun':
      return {
        install: resolveCommandWithFallback({
          command: 'bun',
          args: ['install', '--frozen-lockfile'],
        }),
        execDrizzleKit: (configPath) =>
          resolveCommandWithFallback({
            command: 'bun',
            args: ['x', 'drizzle-kit', 'export', '--config', configPath],
          }),
      };
    case 'pnpm':
      return {
        install: resolveCommandWithFallback(
          {
            command: 'pnpm',
            args: ['install', '--frozen-lockfile'],
          },
          {
            command: 'corepack',
            args: ['pnpm', 'install', '--frozen-lockfile'],
          }
        ),
        execDrizzleKit: (configPath) =>
          resolveCommandWithFallback(
            {
              command: 'pnpm',
              args: ['exec', 'drizzle-kit', 'export', '--config', configPath],
            },
            {
              command: 'corepack',
              args: ['pnpm', 'exec', 'drizzle-kit', 'export', '--config', configPath],
            }
          ),
      };
    case 'yarn':
      return {
        install: resolveCommandWithFallback(
          {
            command: 'yarn',
            args: ['install', '--immutable'],
          },
          {
            command: 'corepack',
            args: ['yarn', 'install', '--immutable'],
          }
        ),
        execDrizzleKit: (configPath) =>
          resolveCommandWithFallback(
            {
              command: 'yarn',
              args: ['exec', 'drizzle-kit', 'export', '--config', configPath],
            },
            {
              command: 'corepack',
              args: ['yarn', 'exec', 'drizzle-kit', 'export', '--config', configPath],
            }
          ),
      };
    default:
      return {
        install: resolveCommandWithFallback({
          command: 'npm',
          args: packageManager.hasLockfile ? ['ci'] : ['install'],
        }),
        execDrizzleKit: (configPath) =>
          resolveCommandWithFallback({
            command: 'npx',
            args: ['drizzle-kit', 'export', '--config', configPath],
          }),
      };
  }
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
  const packageManager = await detectPackageManager(input.workspace.repoDir);
  const commands = resolvePackageManagerCommands(packageManager);
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
      cleanup: async () => {
        await rm(workspace.tempRoot, { recursive: true, force: true });
      },
      ...result,
    };
  } catch (error) {
    await rm(workspace.tempRoot, { recursive: true, force: true });
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
