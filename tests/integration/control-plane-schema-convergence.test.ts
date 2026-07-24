import { describe, expect, it } from 'bun:test';
import { randomUUID } from 'node:crypto';
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
    'terminalizes imported source handoffs without claiming unverified production releases',
    async () => {
      const migrationFiles = (await readdir('migrations'))
        .filter((fileName) => fileName.endsWith('.sql'))
        .sort();
      const deliveryControlPlaneIndex = migrationFiles.indexOf(
        '20260724120000_delivery_control_plane.sql'
      );
      if (deliveryControlPlaneIndex === -1) {
        throw new Error('Missing delivery control-plane migration');
      }

      const scratch = await prepareAtlasDevDatabaseSession('postgresql');
      const sql = postgres(scratch.url, { max: 1 });
      const userId = randomUUID();
      const teamId = randomUUID();
      const providerId = randomUUID();
      const repositoryId = randomUUID();
      const projectId = randomUUID();
      const historicalDeliveryId = randomUUID();
      const noOpDeliveryId = randomUUID();
      const noOpBuildId = randomUUID();
      const historicalProviderDeliveryId = randomUUID();
      const noOpProviderDeliveryId = randomUUID();

      try {
        await runAtlasCommand(
          buildAtlasMigrateApplyArgs({
            databaseUrl: scratch.url,
            migrationCount: deliveryControlPlaneIndex,
          })
        );

        await sql.begin(async (transaction) => {
          await transaction`
            INSERT INTO "user" (id, email)
            VALUES (${userId}, ${`${userId}@example.test`})
          `;
          await transaction`
            INSERT INTO team (id, name, slug)
            VALUES (${teamId}, 'Delivery History', ${`delivery-history-${teamId}`})
          `;
          await transaction`
            INSERT INTO integration_identity (id, "userId", provider)
            VALUES (${providerId}, ${userId}, 'github')
          `;
          await transaction`
            INSERT INTO repository (id, "providerId", "externalId", "fullName", name, owner)
            VALUES (
              ${repositoryId}, ${providerId}, ${repositoryId},
              'acme/delivery-history', 'delivery-history', 'acme'
            )
          `;
          await transaction`
            INSERT INTO project (id, "teamId", "repositoryId", name, slug, status)
            VALUES (
              ${projectId}, ${teamId}, ${repositoryId},
              'Delivery History', ${`delivery-history-${projectId}`}, 'active'
            )
          `;
          await transaction`
            INSERT INTO "sourceDelivery" (
              id, "projectId", "repositoryId", provider, "providerDeliveryId",
              "sourceRepository", "sourceRef", "sourceCommitSha", status,
              "attemptCount", "dispatchedAt", "createdAt", "updatedAt"
            )
            VALUES
              (
                ${historicalDeliveryId}, ${projectId}, ${repositoryId}, 'github',
                ${historicalProviderDeliveryId}, 'acme/delivery-history', 'refs/heads/main',
                ${'a'.repeat(40)}, 'dispatched', 1, now() - interval '2 hours',
                now() - interval '2 hours', now() - interval '2 hours'
              ),
              (
                ${noOpDeliveryId}, ${projectId}, ${repositoryId}, 'github',
                ${noOpProviderDeliveryId}, 'acme/delivery-history', 'refs/heads/main',
                ${'b'.repeat(40)}, 'dispatched', 1, now() - interval '1 hour',
                now() - interval '1 hour', now() - interval '1 hour'
              )
          `;
          await transaction`
            INSERT INTO "buildRun" (
              id, "projectId", "repositoryId", "sourceRepository", "sourceRef",
              "sourceCommitSha", provider, "externalRunId", status, plan,
              "createdAt", "updatedAt", "finishedAt"
            )
            VALUES (
              ${noOpBuildId}, ${projectId}, ${repositoryId}, 'acme/delivery-history',
              'refs/heads/main', ${'b'.repeat(40)}, 'github', ${noOpProviderDeliveryId},
              'succeeded', ${sql.json({ units: [], release: { requiredUnits: [] } })},
              now() - interval '1 hour', now() - interval '1 hour', now() - interval '1 hour'
            )
          `;
        });

        await runAtlasCommand(buildAtlasMigrateApplyArgs({ databaseUrl: scratch.url }));

        const executions = await sql<
          Array<{ providerDeliveryId: string; status: string; events: string[] }>
        >`
          SELECT
            execution."providerDeliveryId",
            execution.status::text AS status,
            array_agg(event.type ORDER BY event.sequence) AS events
          FROM "deliveryExecution" execution
          JOIN "deliveryExecutionEvent" event
            ON event."deliveryExecutionId" = execution.id
          WHERE execution.id IN (${historicalDeliveryId}, ${noOpDeliveryId})
          GROUP BY execution.id
          ORDER BY execution."providerDeliveryId"
        `;
        const noOpBuild = await sql<Array<{ status: string }>>`
          SELECT status::text AS status FROM "buildRun" WHERE id = ${noOpBuildId}
        `;

        expect(
          Object.fromEntries(
            executions.map((execution) => [
              execution.providerDeliveryId,
              { status: execution.status, events: execution.events },
            ])
          )
        ).toEqual({
          [historicalProviderDeliveryId]: {
            status: 'historical',
            events: ['source.received', 'execution.history.imported'],
          },
          [noOpProviderDeliveryId]: {
            status: 'production_verified',
            events: ['source.received', 'delivery.no_change'],
          },
        });
        expect(noOpBuild).toEqual([{ status: 'finalized' }]);
      } finally {
        await sql.end();
        await scratch.cleanup();
      }
    },
    120_000
  );

  integrationTest(
    'repairs the original release-plan migration state through one append-only revision',
    async () => {
      const migrationFiles = (await readdir('migrations'))
        .filter((fileName) => fileName.endsWith('.sql'))
        .sort();
      const repairStart = migrationFiles.indexOf(
        '20260721162900_attach_environment_schema_state_unique_constraint.sql'
      );
      if (repairStart === -1) {
        throw new Error('Missing release-plan schema repair migration chain');
      }
      expect(migrationFiles.slice(repairStart, repairStart + 3)).toEqual([
        '20260721162900_attach_environment_schema_state_unique_constraint.sql',
        '20260721163000_reconcile_release_migration_plan_schema.sql',
        '20260722040146_source_delivery_durability.sql',
      ]);

      const scratch = await prepareAtlasDevDatabaseSession('postgresql');
      const sql = postgres(scratch.url, { max: 1 });

      try {
        await runAtlasCommand(
          buildAtlasMigrateApplyArgs({
            databaseUrl: scratch.url,
            migrationCount: repairStart,
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
