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

interface PostSchemaTask {
  name: string;
  run: () => Promise<void>;
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
} finally {
  await sql.end();
}
