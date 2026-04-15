import { spawn, spawnSync } from 'node:child_process';
import { mkdir, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import postgres from 'postgres';
import { getNormalizedDatabaseUrlFromEnv } from './connection-url';

const ATLAS_VERSION = process.env.ATLAS_VERSION ?? '1.1.0';
const ATLAS_DOCKER_IMAGE =
  process.env.ATLAS_DOCKER_IMAGE ?? `arigaio/atlas:${ATLAS_VERSION}-community`;
const MIGRATIONS_DIR_URL = 'file://migrations';
const REVISIONS_SCHEMA = 'public';
const DEFAULT_DEV_URL = 'docker://postgres/16/dev?search_path=public';
const DRIZZLE_SCHEMA_CONFIG_PATH = 'drizzle.schema.config.ts';
const EXPORTED_SCHEMA_PATH = path.join('.atlas', 'control-plane.sql');
const ATLAS_REVISIONS_TABLE = 'atlas_schema_revisions';
const LEGACY_MIGRATIONS_TABLE = '_migrations';

type AtlasCommand = 'generate' | 'hash' | 'validate' | 'status' | 'apply';

function hasExecutable(command: string): boolean {
  return spawnSync(command, ['--help'], { stdio: 'ignore' }).status === 0;
}

function hasLocalAtlas(): boolean {
  return hasExecutable('atlas');
}

function getCommand(
  args: string[],
  options?: {
    network?: string;
  }
): { command: string; args: string[] } {
  if (hasLocalAtlas()) {
    return {
      command: 'atlas',
      args,
    };
  }

  if (!hasExecutable('docker')) {
    throw new Error('Atlas CLI 未安装，且当前环境没有可用的 Docker，无法执行数据库迁移');
  }

  const dockerArgs = ['run', '--rm', '-v', `${process.cwd()}:/workspace`, '-w', '/workspace'];

  if (process.platform === 'linux') {
    dockerArgs.push('--add-host', 'host.docker.internal:host-gateway');
  }

  if (options?.network) {
    dockerArgs.push('--network', options.network);
  }

  return {
    command: 'docker',
    args: [...dockerArgs, ATLAS_DOCKER_IMAGE, ...args],
  };
}

function runProcess(command: string, args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: 'inherit',
      env: resolveAtlasProcessEnv(),
    });

    child.on('error', reject);
    child.on('exit', (code) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(new Error(`${command} ${args.join(' ')} exited with code ${code ?? 'unknown'}`));
    });
  });
}

function resolveAtlasProcessEnv(): NodeJS.ProcessEnv {
  try {
    return {
      ...process.env,
      ATLAS_DATABASE_URL: getNormalizedDatabaseUrlFromEnv(),
    };
  } catch {
    return process.env;
  }
}

async function runAtlas(
  args: string[],
  options?: {
    network?: string;
  }
): Promise<void> {
  const command = getCommand(args, options);
  await runProcess(command.command, command.args);
}

function normalizeUrlForDocker(rawUrl: string): string {
  const parsed = new URL(rawUrl);
  if (parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1') {
    parsed.hostname = 'host.docker.internal';
  }
  return parsed.toString();
}

function shouldRewriteDatabaseUrl(): boolean {
  return !hasLocalAtlas() && hasExecutable('docker');
}

function getDatabaseUrl(): string {
  const databaseUrl = getNormalizedDatabaseUrlFromEnv();
  return shouldRewriteDatabaseUrl() ? normalizeUrlForDocker(databaseUrl) : databaseUrl;
}

async function getMigrationFiles(): Promise<string[]> {
  const entries = await readdir(path.resolve(process.cwd(), 'migrations'), { withFileTypes: true });
  return entries
    .filter((entry) => entry.isFile() && entry.name.endsWith('.sql'))
    .map((entry) => entry.name)
    .sort((left, right) => left.localeCompare(right));
}

function extractVersion(fileName: string): string {
  const [version] = fileName.split('_');
  if (!version) {
    throw new Error(`无法从 migration 文件名提取版本: ${fileName}`);
  }
  return version;
}

async function getAtlasRevisionCount(databaseUrl: string): Promise<number> {
  const sql = postgres(databaseUrl, { max: 1 });
  try {
    const tableName = `${REVISIONS_SCHEMA}.${ATLAS_REVISIONS_TABLE}`;
    const [table] = await sql<{ regclass: string | null }[]>`
      select to_regclass(${tableName}) as regclass
    `;

    if (!table?.regclass) {
      return 0;
    }

    const rows = await sql.unsafe(
      `select count(*)::int as count from "${REVISIONS_SCHEMA}"."${ATLAS_REVISIONS_TABLE}"`
    );
    return Number(rows[0]?.count ?? 0);
  } finally {
    await sql.end();
  }
}

async function hasLegacyMigrationState(databaseUrl: string): Promise<boolean> {
  const sql = postgres(databaseUrl, { max: 1 });
  try {
    const [table] = await sql<{ regclass: string | null }[]>`
      select to_regclass(${LEGACY_MIGRATIONS_TABLE}) as regclass
    `;

    if (!table?.regclass) {
      return false;
    }

    const rows = await sql<{ count: number }[]>`
      select count(*)::int as count
      from "_migrations"
    `;

    return Number(rows[0]?.count ?? 0) > 0;
  } finally {
    await sql.end();
  }
}

async function getAtlasBaselineVersion(): Promise<string> {
  const migrationFiles = await getMigrationFiles();
  const firstFile = migrationFiles[0];
  if (!firstFile) {
    throw new Error('migrations/ 目录为空，无法执行 Atlas baseline');
  }

  return extractVersion(firstFile);
}

async function exportDesiredSchema(): Promise<void> {
  await mkdir(path.dirname(EXPORTED_SCHEMA_PATH), { recursive: true });

  const output = spawnSync(
    'bunx',
    ['drizzle-kit', 'export', '--config', DRIZZLE_SCHEMA_CONFIG_PATH],
    {
      cwd: process.cwd(),
      env: process.env,
      encoding: 'utf8',
      maxBuffer: 20 * 1024 * 1024,
    }
  );

  if (output.status !== 0) {
    throw new Error(output.stderr || output.stdout || 'drizzle export failed');
  }

  await writeFile(EXPORTED_SCHEMA_PATH, output.stdout, 'utf8');
}

async function withDockerDevDatabase<T>(
  task: (input: { devUrl: string; networkName: string }) => Promise<T>
): Promise<T> {
  if (!hasExecutable('docker')) {
    throw new Error('当前环境缺少 Docker，无法创建 Atlas dev database');
  }

  const suffix = Date.now().toString(36);
  const networkName = `juanie-atlas-${suffix}`;
  const containerName = `juanie-atlas-dev-${suffix}`;

  await runProcess('docker', ['network', 'create', networkName]);
  await runProcess('docker', [
    'run',
    '-d',
    '--rm',
    '--name',
    containerName,
    '--network',
    networkName,
    '-e',
    'POSTGRES_PASSWORD=postgres',
    '-e',
    'POSTGRES_DB=dev',
    'postgres:16-alpine',
  ]);

  try {
    for (let attempt = 0; attempt < 30; attempt += 1) {
      const result = spawnSync(
        'docker',
        ['exec', containerName, 'pg_isready', '-U', 'postgres', '-d', 'dev'],
        { stdio: 'ignore' }
      );
      if (result.status === 0) {
        break;
      }

      if (attempt === 29) {
        throw new Error('临时 Atlas dev database 启动超时');
      }

      await new Promise((resolve) => setTimeout(resolve, 1000));
    }

    return await task({
      devUrl: `postgres://postgres:postgres@${containerName}:5432/dev?sslmode=disable&search_path=public`,
      networkName,
    });
  } finally {
    spawnSync('docker', ['rm', '-f', containerName], { stdio: 'ignore' });
    spawnSync('docker', ['network', 'rm', networkName], { stdio: 'ignore' });
  }
}

function normalizeMigrationName(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

export async function hashControlPlaneMigrations(): Promise<void> {
  await runAtlas(['migrate', 'hash', '--dir', MIGRATIONS_DIR_URL]);
}

export async function generateControlPlaneMigration(name: string | undefined): Promise<void> {
  const normalizedName = normalizeMigrationName(name ?? '');
  if (!normalizedName) {
    throw new Error('请提供 migration 名称，例如 bun run db:generate add_schema_repair_artifacts');
  }

  await exportDesiredSchema();

  if (hasLocalAtlas()) {
    await runAtlas([
      'migrate',
      'diff',
      normalizedName,
      '--dir',
      MIGRATIONS_DIR_URL,
      '--dev-url',
      DEFAULT_DEV_URL,
      '--to',
      `file://${EXPORTED_SCHEMA_PATH}`,
    ]);
    return;
  }

  await withDockerDevDatabase(async ({ devUrl, networkName }) => {
    await runAtlas(
      [
        'migrate',
        'diff',
        normalizedName,
        '--dir',
        MIGRATIONS_DIR_URL,
        '--dev-url',
        devUrl,
        '--to',
        `file://${EXPORTED_SCHEMA_PATH}`,
      ],
      { network: networkName }
    );
  });
}

export async function validateControlPlaneMigrations(): Promise<void> {
  await exportDesiredSchema();

  if (hasLocalAtlas()) {
    await runAtlas([
      'migrate',
      'validate',
      '--dir',
      MIGRATIONS_DIR_URL,
      '--dev-url',
      DEFAULT_DEV_URL,
    ]);
    return;
  }

  await withDockerDevDatabase(async ({ devUrl, networkName }) => {
    await runAtlas(['migrate', 'validate', '--dir', MIGRATIONS_DIR_URL, '--dev-url', devUrl], {
      network: networkName,
    });
  });
}

export async function printControlPlaneMigrationStatus(): Promise<void> {
  await runAtlas([
    'migrate',
    'status',
    '--dir',
    MIGRATIONS_DIR_URL,
    '--url',
    getDatabaseUrl(),
    '--revisions-schema',
    REVISIONS_SCHEMA,
  ]);
}

async function runPostMigrationTasks(databaseUrl: string): Promise<void> {
  const sql = postgres(databaseUrl, { max: 1 });
  try {
    const updatedReleases = await sql<{ id: string }[]>`
      with blocked_release as (
        select
          "releaseId",
          case
            when bool_or(status = 'awaiting_external_completion') then 'awaiting_external_completion'
            else 'awaiting_approval'
          end as status
        from "migrationRun"
        where "releaseId" is not null
          and status in ('awaiting_approval', 'awaiting_external_completion')
        group by "releaseId"
      )
      update "release" as release
      set status = blocked_release.status::"releaseStatus",
          "errorMessage" = null,
          recap = null,
          "updatedAt" = now()
      from blocked_release
      where release.id = blocked_release."releaseId"
        and release.status <> blocked_release.status::"releaseStatus"
      returning release.id
    `;

    console.log(`[db:push] normalized ${updatedReleases.length} gated release(s)`);
  } finally {
    await sql.end();
  }
}

export async function applyControlPlaneMigrations(): Promise<void> {
  const databaseUrl = getDatabaseUrl();

  const atlasRevisionCount = await getAtlasRevisionCount(databaseUrl);
  if (atlasRevisionCount === 0) {
    const hasLegacyState = await hasLegacyMigrationState(databaseUrl);
    if (hasLegacyState) {
      const baselineVersion = await getAtlasBaselineVersion();
      console.log(`[db:push] adopting legacy migration state at version ${baselineVersion}`);
      await runAtlas([
        'migrate',
        'set',
        baselineVersion,
        '--dir',
        MIGRATIONS_DIR_URL,
        '--url',
        databaseUrl,
        '--revisions-schema',
        REVISIONS_SCHEMA,
      ]);
    }
  }

  await runAtlas([
    'migrate',
    'apply',
    '--dir',
    MIGRATIONS_DIR_URL,
    '--url',
    databaseUrl,
    '--revisions-schema',
    REVISIONS_SCHEMA,
  ]);

  await runPostMigrationTasks(databaseUrl);
}

export async function executeControlPlaneAtlasCommand(
  command: string | undefined,
  arg?: string
): Promise<void> {
  switch (command as AtlasCommand | undefined) {
    case 'generate':
      await generateControlPlaneMigration(arg);
      return;
    case 'hash':
      await hashControlPlaneMigrations();
      return;
    case 'validate':
      await validateControlPlaneMigrations();
      return;
    case 'status':
      await printControlPlaneMigrationStatus();
      return;
    case 'apply':
      await applyControlPlaneMigrations();
      return;
    default:
      throw new Error(
        'Usage: bun src/lib/db/control-plane-atlas.ts <generate|hash|validate|status|apply> [name]'
      );
  }
}

async function main(): Promise<void> {
  if (!import.meta.main) {
    return;
  }

  const [command, arg] = process.argv.slice(2);
  await executeControlPlaneAtlasCommand(command, arg);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
