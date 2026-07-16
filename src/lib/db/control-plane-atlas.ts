import { spawnSync } from 'node:child_process';
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import postgres from 'postgres';
import {
  canUseDockerAtlas,
  hasExecutable,
  hasLocalAtlas,
  normalizeAtlasDatabaseUrl,
  runAtlasCommand,
} from '@/lib/atlas/cli';
import { encrypt } from '@/lib/crypto';
import { encryptGrantCredentials } from '@/lib/integrations/service/grant-credentials';
import {
  buildAtlasMigrateApplyArgs,
  buildAtlasMigrateSetArgs,
  resolveAtlasBoundedMigrationCount,
} from '@/lib/migrations/atlas';
import { prepareAtlasDevDatabaseSession } from '@/lib/migrations/atlas-dev-database';
import { getNormalizedDatabaseUrlFromEnv } from './connection-url';

const MIGRATIONS_DIR_URL = 'file://migrations';
const CONTRACT_MIGRATIONS_DIR_URL = 'file://migrations-contract';
const REVISIONS_SCHEMA = 'public';
const DRIZZLE_SCHEMA_CONFIG_PATH = 'drizzle.schema.config.ts';
const EXPORTED_SCHEMA_PATH = path.join('.atlas', 'control-plane.sql');
const ATLAS_REVISIONS_TABLE = 'atlas_schema_revisions';
const CONTRACT_REVISIONS_SCHEMA = 'atlas_contract';
const LEGACY_MIGRATIONS_TABLE = '_migrations';
const CREDENTIAL_ENVELOPE_VERSION = '20260713120000';
const PLAINTEXT_CREDENTIAL_REMOVAL_VERSION = '20260713121000';
const LEGACY_CONTRACT_BOUNDARY_VERSION = PLAINTEXT_CREDENTIAL_REMOVAL_VERSION;
const CONTROL_PLANE_CONTRACT_EPOCH = '20260715';

type AtlasCommand = 'generate' | 'hash' | 'validate' | 'status' | 'apply' | 'contract';

async function runProcess(command: string, args: string[]): Promise<void> {
  const result = spawnSync(command, args, {
    cwd: process.cwd(),
    stdio: 'ignore',
    env: process.env,
    encoding: 'utf8',
  });

  if (result.status !== 0) {
    throw new Error(result.stderr || result.stdout || `${command} ${args.join(' ')} failed`);
  }
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
  await runAtlasCommand(args, {
    cwd: process.cwd(),
    env: resolveAtlasProcessEnv(),
    network: options?.network,
  });
}

function getDatabaseUrl(): string {
  const databaseUrl = getNormalizedDatabaseUrlFromEnv();
  return canUseDockerAtlas() ? normalizeAtlasDatabaseUrl(databaseUrl) : databaseUrl;
}

async function getMigrationFiles(): Promise<string[]> {
  const entries = await readdir(path.resolve(process.cwd(), 'migrations'), { withFileTypes: true });
  return entries
    .filter((entry) => entry.isFile() && entry.name.endsWith('.sql'))
    .map((entry) => entry.name)
    .sort((left, right) => left.localeCompare(right));
}

async function validateExpandMigrationSafety(): Promise<void> {
  const destructiveDdl = /\b(drop\s+(table|column|type)|rename\s+(table|column))\b/iu;
  for (const fileName of await getMigrationFiles()) {
    if (extractVersion(fileName) <= LEGACY_CONTRACT_BOUNDARY_VERSION) continue;
    const migration = await readFile(path.join(process.cwd(), 'migrations', fileName), 'utf8');
    if (destructiveDdl.test(migration)) {
      throw new Error(
        `Expand migration ${fileName} contains destructive DDL; move it to migrations-contract/`
      );
    }
  }
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

async function isAtlasRevisionApplied(databaseUrl: string, version: string): Promise<boolean> {
  return (await getAtlasAppliedVersions(databaseUrl)).includes(version);
}

async function getAtlasAppliedVersions(databaseUrl: string): Promise<string[]> {
  const sql = postgres(databaseUrl, { max: 1 });
  try {
    const tableName = `${REVISIONS_SCHEMA}.${ATLAS_REVISIONS_TABLE}`;
    const [table] = await sql<{ regclass: string | null }[]>`
      select to_regclass(${tableName}) as regclass
    `;
    if (!table?.regclass) {
      return [];
    }
    const rows = await sql.unsafe(
      `select version
       from "${REVISIONS_SCHEMA}"."${ATLAS_REVISIONS_TABLE}"
       where (applied is null or total is null or applied = total)
         and (error is null or error = '')
       order by version asc`
    );
    return rows.map((row) => (typeof row.version === 'string' ? row.version : '')).filter(Boolean);
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
    'postgres:17-alpine',
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
  await runAtlas(['migrate', 'hash', '--dir', CONTRACT_MIGRATIONS_DIR_URL]);
}

export async function generateControlPlaneMigration(name: string | undefined): Promise<void> {
  const normalizedName = normalizeMigrationName(name ?? '');
  if (!normalizedName) {
    throw new Error('请提供 migration 名称，例如 bun run db:generate add_schema_repair_artifacts');
  }

  await exportDesiredSchema();

  if (hasLocalAtlas()) {
    const devDatabase = await prepareAtlasDevDatabaseSession('postgresql');
    try {
      await runAtlas([
        'migrate',
        'diff',
        normalizedName,
        '--dir',
        MIGRATIONS_DIR_URL,
        '--dev-url',
        devDatabase.url,
        '--to',
        `file://${EXPORTED_SCHEMA_PATH}`,
      ]);
    } finally {
      await devDatabase.cleanup();
    }
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
  await validateExpandMigrationSafety();
  await exportDesiredSchema();

  if (hasLocalAtlas()) {
    const devDatabase = await prepareAtlasDevDatabaseSession('postgresql');
    try {
      await runAtlas([
        'migrate',
        'validate',
        '--dir',
        MIGRATIONS_DIR_URL,
        '--dev-url',
        devDatabase.url,
      ]);
      await runAtlas([
        'migrate',
        'validate',
        '--dir',
        CONTRACT_MIGRATIONS_DIR_URL,
        '--dev-url',
        devDatabase.url,
      ]);
    } finally {
      await devDatabase.cleanup();
    }
    return;
  }

  await withDockerDevDatabase(async ({ devUrl, networkName }) => {
    await runAtlas(['migrate', 'validate', '--dir', MIGRATIONS_DIR_URL, '--dev-url', devUrl], {
      network: networkName,
    });
    await runAtlas(
      ['migrate', 'validate', '--dir', CONTRACT_MIGRATIONS_DIR_URL, '--dev-url', devUrl],
      { network: networkName }
    );
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

async function migrateCredentialEnvelopes(databaseUrl: string): Promise<void> {
  const sql = postgres(databaseUrl, { max: 1 });
  try {
    const plaintextGrants = await sql<
      {
        id: string;
        accessToken: string;
        refreshToken: string | null;
      }[]
    >`
      select id, "accessToken", "refreshToken"
      from "integration_grant"
      where "accessToken" is not null
        and "accessTokenEncrypted" is null
    `;

    const encryptedGrants = await Promise.all(
      plaintextGrants.map(async (grant) => ({
        id: grant.id,
        credentials: await encryptGrantCredentials({
          grantId: grant.id,
          accessToken: grant.accessToken,
          refreshToken: grant.refreshToken,
        }),
      }))
    );

    await sql.begin(async (transaction) => {
      for (const grant of encryptedGrants) {
        const credentials = grant.credentials;
        await transaction`
          update "integration_grant"
          set "accessTokenEncrypted" = ${credentials.accessTokenEncrypted},
              "accessTokenIv" = ${credentials.accessTokenIv},
              "accessTokenAuthTag" = ${credentials.accessTokenAuthTag},
              "refreshTokenEncrypted" = ${credentials.refreshTokenEncrypted},
              "refreshTokenIv" = ${credentials.refreshTokenIv},
              "refreshTokenAuthTag" = ${credentials.refreshTokenAuthTag},
              "encryptionKeyVersion" = ${credentials.encryptionKeyVersion},
              "accessToken" = null,
              "refreshToken" = null,
              "updatedAt" = now()
          where id = ${grant.id}
        `;
      }

      await transaction`
        update "account"
        set access_token = null,
            refresh_token = null,
            id_token = null
        where access_token is not null
           or refresh_token is not null
           or id_token is not null
      `;
    });

    const [unencryptedActiveGrant] = await sql<{ id: string }[]>`
      select id
      from "integration_grant"
      where "revokedAt" is null
        and (
          "accessTokenEncrypted" is null
          or "accessTokenIv" is null
          or "accessTokenAuthTag" is null
          or "encryptionKeyVersion" is null
        )
      limit 1
    `;
    if (unencryptedActiveGrant) {
      throw new Error(
        `Active integration grant ${unencryptedActiveGrant.id} has no encrypted credentials`
      );
    }

    console.log(`[db:push] encrypted ${encryptedGrants.length} integration grant(s)`);
  } finally {
    await sql.end();
  }
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

async function migrateEnvironmentSecretEnvelopes(databaseUrl: string): Promise<void> {
  const sql = postgres(databaseUrl, { max: 1 });
  try {
    const variables = await sql<{ id: string; value: string | null }[]>`
      select id, value
      from "environmentVariable"
      where "isSecret" = true
        and ("encryptedValue" is null or iv is null or "authTag" is null or value is not null)
    `;
    for (const variable of variables) {
      if (!variable.value) {
        throw new Error(`Secret environment variable ${variable.id} has no encryptable value`);
      }
      const encrypted = await encrypt(variable.value);
      await sql`
        update "environmentVariable"
        set value = null,
            "encryptedValue" = ${encrypted.encryptedValue},
            iv = ${encrypted.iv},
            "authTag" = ${encrypted.authTag},
            "updatedAt" = now()
        where id = ${variable.id}
      `;
    }
    await sql`
      alter table "environmentVariable"
      validate constraint "environmentVariable_secret_envelope_required"
    `;
    console.log(`[db:push] encrypted ${variables.length} environment secret(s)`);
  } finally {
    await sql.end();
  }
}

export async function applyControlPlaneMigrations(): Promise<void> {
  await applyControlPlaneExpandMigrations();
}

async function ensureAtlasBaseline(databaseUrl: string): Promise<void> {
  const atlasRevisionCount = await getAtlasRevisionCount(databaseUrl);
  if (atlasRevisionCount === 0) {
    const hasLegacyState = await hasLegacyMigrationState(databaseUrl);
    if (hasLegacyState) {
      const baselineVersion = await getAtlasBaselineVersion();
      console.log(`[db:push] adopting legacy migration state at version ${baselineVersion}`);
      await runAtlas(buildAtlasMigrateSetArgs({ databaseUrl, version: baselineVersion }));
    }
  }
}

async function applyControlPlaneMigrationsThroughVersion(
  databaseUrl: string,
  targetVersion: string
): Promise<void> {
  const declaredVersions = (await getMigrationFiles()).map(extractVersion);
  const migrationCount = resolveAtlasBoundedMigrationCount({
    declaredVersions,
    appliedVersions: await getAtlasAppliedVersions(databaseUrl),
    targetVersion,
  });

  if (migrationCount !== 0) {
    await runAtlas(buildAtlasMigrateApplyArgs({ databaseUrl, migrationCount }));
  }

  const appliedVersions = await getAtlasAppliedVersions(databaseUrl);
  if (!appliedVersions.includes(targetVersion)) {
    throw new Error(`Control-plane Atlas target ${targetVersion} was not recorded after execution`);
  }
}

export async function applyControlPlaneExpandMigrations(): Promise<void> {
  const databaseUrl = getDatabaseUrl();
  await ensureAtlasBaseline(databaseUrl);

  const plaintextCredentialsRemoved = await isAtlasRevisionApplied(
    databaseUrl,
    PLAINTEXT_CREDENTIAL_REMOVAL_VERSION
  );
  if (!plaintextCredentialsRemoved) {
    const envelopeMigrationApplied = await isAtlasRevisionApplied(
      databaseUrl,
      CREDENTIAL_ENVELOPE_VERSION
    );
    if (!envelopeMigrationApplied) {
      await applyControlPlaneMigrationsThroughVersion(databaseUrl, CREDENTIAL_ENVELOPE_VERSION);
    }
    await migrateCredentialEnvelopes(databaseUrl);
  }

  // Once the contract revision is present, every later migration is required to be
  // backward-compatible and can run in the pre-upgrade phase.
  await runAtlas(buildAtlasMigrateApplyArgs({ databaseUrl }));

  await runPostMigrationTasks(databaseUrl);
  await migrateEnvironmentSecretEnvelopes(databaseUrl);
}

export async function applyControlPlaneContractMigrations(
  promotedEpoch = process.env.CONTROL_PLANE_CONTRACT_PROMOTION
): Promise<void> {
  if (promotedEpoch !== CONTROL_PLANE_CONTRACT_EPOCH) {
    throw new Error(
      `Contract migration requires explicit promotion epoch ${CONTROL_PLANE_CONTRACT_EPOCH}`
    );
  }
  const databaseUrl = getDatabaseUrl();
  await ensureAtlasBaseline(databaseUrl);
  await runAtlas([
    'migrate',
    'apply',
    '--dir',
    CONTRACT_MIGRATIONS_DIR_URL,
    '--url',
    databaseUrl,
    '--revisions-schema',
    CONTRACT_REVISIONS_SCHEMA,
  ]);
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
    case 'contract':
      await applyControlPlaneContractMigrations(arg);
      return;
    default:
      throw new Error(
        'Usage: bun src/lib/db/control-plane-atlas.ts <generate|hash|validate|status|apply|contract> [name-or-epoch]'
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
