import postgres from 'postgres';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

function exitWith(code: number): never {
  process.exit(code);
}

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  console.error('DATABASE_URL is required');
  exitWith(1);
}

const sql = postgres(databaseUrl, {
  max: 1,
});

const migrationTableName = '_migrations';
const advisoryLockKey = 28619131;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const migrationsDir = path.resolve(__dirname, '../migrations');

interface PostSchemaTask {
  name: string;
  run: () => Promise<void>;
}

function getErrorCode(error: unknown): string | null {
  if (typeof error === 'object' && error !== null && 'code' in error) {
    const code = (error as { code?: unknown }).code;
    return typeof code === 'string' ? code : null;
  }
  return null;
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}

function isLegacyBaselineConflict(error: unknown): boolean {
  const code = getErrorCode(error);
  if (code && ['42P07', '42710', '42701'].includes(code)) {
    return true;
  }
  return getErrorMessage(error).toLowerCase().includes('already exists');
}

async function ensureMigrationTable(): Promise<void> {
  await sql.unsafe(`
    CREATE TABLE IF NOT EXISTS "${migrationTableName}" (
      "id" serial PRIMARY KEY,
      "name" varchar(255) NOT NULL UNIQUE,
      "executed_at" timestamp NOT NULL DEFAULT NOW()
    );
  `);
}

async function acquireMigrationLock(): Promise<void> {
  await sql`select pg_advisory_lock(${advisoryLockKey});`;
}

async function releaseMigrationLock(): Promise<void> {
  await sql`select pg_advisory_unlock(${advisoryLockKey});`;
}

async function getAppliedMigrations(): Promise<Set<string>> {
  const rows = await sql<{ name: string }[]>`
    select "name"
    from "_migrations"
    order by "name" asc
  `;
  return new Set(rows.map((row) => row.name));
}

async function listMigrationFiles(): Promise<string[]> {
  const entries = await readdir(migrationsDir, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isFile() && entry.name.endsWith('.sql'))
    .map((entry) => entry.name)
    .sort((left, right) => left.localeCompare(right));
}

async function markMigrationApplied(fileName: string): Promise<void> {
  await sql`
    insert into "_migrations" ("name")
    values (${fileName})
    on conflict ("name") do nothing
  `;
}

async function applySqlMigrations(): Promise<void> {
  await ensureMigrationTable();
  const files = await listMigrationFiles();
  const applied = await getAppliedMigrations();
  const isBootstrapMode = applied.size === 0;

  if (files.length === 0) {
    console.log('[db:push] no SQL migrations found');
    return;
  }

  let appliedCount = 0;
  let baselineAdoptedCount = 0;

  for (const fileName of files) {
    if (applied.has(fileName)) {
      continue;
    }

    const filePath = path.join(migrationsDir, fileName);
    const content = await readFile(filePath, 'utf8');

    try {
      console.log(`[db:push] applying ${fileName}`);
      await sql.unsafe(content);
      await markMigrationApplied(fileName);
      appliedCount += 1;
    } catch (error) {
      if (isBootstrapMode && isLegacyBaselineConflict(error)) {
        await markMigrationApplied(fileName);
        baselineAdoptedCount += 1;
        console.warn(
          `[db:push] baseline-adopted ${fileName}: ${getErrorMessage(error)}`,
        );
        continue;
      }

      throw error;
    }
  }

  console.log(
    `[db:push] applied ${appliedCount} migration(s), baseline-adopted ${baselineAdoptedCount} migration(s)`,
  );
}

async function runPostSchemaTasks(tasks: PostSchemaTask[]): Promise<void> {
  for (const task of tasks) {
    try {
      await task.run();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.warn(`[db:push] post-schema task skipped (${task.name}): ${message}`);
    }
  }
}

try {
  await acquireMigrationLock();
  await applySqlMigrations();

  await runPostSchemaTasks([
    {
      name: 'normalize gated releases',
      run: async () => {
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
      },
    },
  ]);
} catch (error) {
  console.error(`[db:push] failed: ${getErrorMessage(error)}`);
  exitWith(1);
} finally {
  try {
    await releaseMigrationLock();
  } catch {
    // no-op
  }
  await sql.end();
}
