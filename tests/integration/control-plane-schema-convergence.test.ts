import { describe, expect, it } from 'bun:test';
import { readdir } from 'node:fs/promises';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { runAtlasCommand } from '@/lib/atlas/cli';
import {
  createControlPlaneReadModelExecutor,
  runControlPlaneReadModelSmoke,
} from '@/lib/db/control-plane-read-model-smoke';
import { assertControlPlaneSchemaContract } from '@/lib/db/control-plane-schema-contract';
import * as schema from '@/lib/db/schema';
import { buildAtlasMigrateApplyArgs } from '@/lib/migrations/atlas';
import { prepareAtlasDevDatabaseSession } from '@/lib/migrations/atlas-dev-database';

const integrationTest = process.env.INTEGRATION_TESTS === 'true' ? it : it.skip;

describe('control-plane schema convergence with PostgreSQL', () => {
  integrationTest(
    'repairs the original release-plan migration state through one append-only revision',
    async () => {
      const migrationFiles = (await readdir('migrations'))
        .filter((fileName) => fileName.endsWith('.sql'))
        .sort();
      expect(migrationFiles.at(-2)).toBe(
        '20260721162900_attach_environment_schema_state_unique_constraint.sql'
      );
      expect(migrationFiles.at(-1)).toBe(
        '20260721163000_reconcile_release_migration_plan_schema.sql'
      );

      const scratch = await prepareAtlasDevDatabaseSession('postgresql');
      const sql = postgres(scratch.url, { max: 1 });

      try {
        await runAtlasCommand(
          buildAtlasMigrateApplyArgs({
            databaseUrl: scratch.url,
            migrationCount: migrationFiles.length - 2,
          })
        );

        await sql.begin(async (transaction) => {
          await transaction.unsafe(
            'ALTER TABLE "migrationRun" DROP COLUMN "releaseMigrationPlanId"'
          );
          await transaction.unsafe('DROP TABLE "releaseMigrationPlan"');
          await transaction.unsafe('DROP TYPE "releaseMigrationPlanStatus"');
          await transaction.unsafe(
            'ALTER TABLE "environmentSchemaState" DROP CONSTRAINT "environmentSchemaState_database_unique"'
          );
          await transaction.unsafe(
            'CREATE UNIQUE INDEX "environmentSchemaState_database_unique" ON "environmentSchemaState" ("databaseId")'
          );
        });

        await runAtlasCommand(buildAtlasMigrateApplyArgs({ databaseUrl: scratch.url }));
        await assertControlPlaneSchemaContract(scratch.url);
        await runControlPlaneReadModelSmoke(
          createControlPlaneReadModelExecutor(drizzle(sql, { schema }))
        );

        const [result] = await sql<
          {
            planTable: string | null;
            planColumn: boolean;
            stateUnique: boolean;
            stateUniqueBackedByHistoricalIndex: boolean;
          }[]
        >`
          SELECT
            to_regclass('public."releaseMigrationPlan"')::text AS "planTable",
            EXISTS (
              SELECT 1 FROM information_schema.columns
              WHERE table_schema = 'public'
                AND table_name = 'migrationRun'
                AND column_name = 'releaseMigrationPlanId'
            ) AS "planColumn",
            EXISTS (
              SELECT 1 FROM pg_constraint
              WHERE conrelid = '"environmentSchemaState"'::regclass
                AND conname = 'environmentSchemaState_database_unique'
            ) AS "stateUnique",
            EXISTS (
              SELECT 1
              FROM pg_constraint
              INNER JOIN pg_class ON pg_class.oid = pg_constraint.conindid
              WHERE pg_constraint.conrelid = '"environmentSchemaState"'::regclass
                AND pg_constraint.conname = 'environmentSchemaState_database_unique'
                AND pg_class.relname = 'environmentSchemaState_database_unique'
            ) AS "stateUniqueBackedByHistoricalIndex"
        `;

        expect(result).toEqual({
          planTable: '"releaseMigrationPlan"',
          planColumn: true,
          stateUnique: true,
          stateUniqueBackedByHistoricalIndex: true,
        });
      } finally {
        await sql.end();
        await scratch.cleanup();
      }
    },
    120_000
  );
});
