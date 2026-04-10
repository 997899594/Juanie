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
  const enumSupport = await sql<{ migrationRunReady: boolean; releaseReady: boolean }[]>`
    select
      exists (
        select 1
        from pg_type as enum_type
        inner join pg_enum as enum_value on enum_value.enumtypid = enum_type.oid
        where enum_type.typname = 'migrationRunStatus'
          and enum_value.enumlabel = 'awaiting_external_completion'
      ) as "migrationRunReady",
      exists (
        select 1
        from pg_type as enum_type
        inner join pg_enum as enum_value on enum_value.enumtypid = enum_type.oid
        where enum_type.typname = 'releaseStatus'
          and enum_value.enumlabel = 'awaiting_external_completion'
      ) as "releaseReady"
  `;

  if (!enumSupport[0]?.migrationRunReady || !enumSupport[0]?.releaseReady) {
    console.log(
      '[db:push] skip gated release normalization: awaiting_external_completion enum values are not ready yet',
    );
  } else {
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
  }
} finally {
  await sql.end();
}
