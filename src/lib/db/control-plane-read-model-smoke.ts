import { db } from '@/lib/db';

export const controlPlaneReadModelNames = [
  'project-overview-migration-runs',
  'release-migration-plans',
] as const;

export type ControlPlaneReadModelName = (typeof controlPlaneReadModelNames)[number];
export type ControlPlaneReadModelExecutor = (name: ControlPlaneReadModelName) => Promise<void>;
type ControlPlaneReadModelDatabase = Pick<typeof db, 'query'>;

export function createControlPlaneReadModelExecutor(
  database: ControlPlaneReadModelDatabase
): ControlPlaneReadModelExecutor {
  return async (name) => {
    if (name === 'project-overview-migration-runs') {
      await database.query.migrationRuns.findMany({
        limit: 1,
        orderBy: (run, { desc }) => [desc(run.createdAt)],
        with: {
          database: true,
          environment: {
            with: {
              domains: true,
            },
          },
          service: true,
          release: true,
        },
      });
      return;
    }

    await database.query.releaseMigrationPlans.findMany({
      limit: 1,
      orderBy: (plan, { desc }) => [desc(plan.createdAt)],
      with: {
        release: true,
        project: true,
        environment: true,
        approvedByUser: true,
        runs: true,
      },
    });
  };
}

const executeControlPlaneReadModel = createControlPlaneReadModelExecutor(db);

export async function runControlPlaneReadModelSmoke(
  execute: ControlPlaneReadModelExecutor = executeControlPlaneReadModel
): Promise<void> {
  for (const name of controlPlaneReadModelNames) {
    try {
      await execute(name);
    } catch (error) {
      throw new Error(
        `Control-plane read-model smoke failed at ${name}: ${error instanceof Error ? error.message : String(error)}`,
        { cause: error }
      );
    }
  }

  console.log(
    `[db:push] verified ${controlPlaneReadModelNames.length} control-plane read model(s)`
  );
}
