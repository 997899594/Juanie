import postgres from 'postgres';
import { spawnSync } from 'node:child_process';

function exitWith(code: number): never {
  process.exit(code);
}

const schemaPush = spawnSync('bunx', ['drizzle-kit', 'push'], {
  stdio: 'inherit',
  env: process.env,
});

if (schemaPush.status !== 0) {
  exitWith(schemaPush.status ?? 1);
}

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  console.error('DATABASE_URL is required');
  exitWith(1);
}

const sql = postgres(databaseUrl, {
  max: 1,
});

try {
  const updatedReleases = await sql<{ id: string }[]>`
    with blocked_release as (
      select distinct "releaseId"
      from "migrationRun"
      where "releaseId" is not null
        and status = 'awaiting_approval'
    )
    update "release" as release
    set status = 'awaiting_approval',
        "errorMessage" = null,
        recap = null,
        "updatedAt" = now()
    from blocked_release
    where release.id = blocked_release."releaseId"
      and release.status <> 'awaiting_approval'
    returning release.id
  `;

  console.log(`[db:push] normalized ${updatedReleases.length} approval-blocked release(s)`);
} finally {
  await sql.end();
}
