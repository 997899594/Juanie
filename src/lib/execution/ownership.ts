import { and, eq, sql } from 'drizzle-orm';
import { db } from '@/lib/db';
import { executionOwnerships, migrationRuns, releases } from '@/lib/db/schema';

export interface ExecutionFence {
  scopeKey: string;
  ownerId: string;
  generation: number;
}

export class ExecutionFenceLostError extends Error {
  constructor(fence: ExecutionFence) {
    super(
      `Execution fence lost for ${fence.scopeKey}: owner ${fence.ownerId} generation ${fence.generation}`
    );
    this.name = 'ExecutionFenceLostError';
  }
}

export function buildReleaseExecutionKey(environmentId: string): string {
  return `environment:${environmentId}`;
}

export function buildMigrationExecutionKey(environmentId: string, databaseId: string): string {
  return `environment:${environmentId}:database:${databaseId}`;
}

export async function claimExecutionOwnership(
  executor: Pick<typeof db, 'insert'>,
  input: {
    scopeKey: string;
    scopeType: 'environment' | 'environment_database' | 'release';
    ownerType: 'release' | 'migration';
    ownerId: string;
  }
): Promise<ExecutionFence> {
  const now = new Date();
  const [ownership] = await executor
    .insert(executionOwnerships)
    .values({
      ...input,
      generation: 1,
      acquiredAt: now,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: executionOwnerships.scopeKey,
      set: {
        scopeType: input.scopeType,
        ownerType: input.ownerType,
        ownerId: input.ownerId,
        generation: sql`${executionOwnerships.generation} + 1`,
        acquiredAt: now,
        updatedAt: now,
      },
    })
    .returning({
      scopeKey: executionOwnerships.scopeKey,
      ownerId: executionOwnerships.ownerId,
      generation: executionOwnerships.generation,
    });

  if (!ownership) throw new Error(`Failed to claim execution ownership for ${input.scopeKey}`);
  return ownership;
}

export async function isExecutionFenceCurrent(
  executor: Pick<typeof db, 'select'>,
  fence: ExecutionFence
): Promise<boolean> {
  const [current] = await executor
    .select({ scopeKey: executionOwnerships.scopeKey })
    .from(executionOwnerships)
    .where(
      and(
        eq(executionOwnerships.scopeKey, fence.scopeKey),
        eq(executionOwnerships.ownerId, fence.ownerId),
        eq(executionOwnerships.generation, fence.generation)
      )
    )
    .for('update')
    .limit(1);
  return Boolean(current);
}

export async function assertReleaseExecutionFence(releaseId: string): Promise<ExecutionFence> {
  const release = await db.query.releases.findFirst({
    where: eq(releases.id, releaseId),
    columns: { id: true, executionKey: true, executionGeneration: true },
  });
  if (!release) throw new Error(`Release ${releaseId} not found`);
  const fence = {
    scopeKey: release.executionKey,
    ownerId: release.id,
    generation: release.executionGeneration,
  };
  await assertExecutionFence(db, fence);
  return fence;
}

export async function assertMigrationRunExecutionFence(runId: string): Promise<ExecutionFence> {
  const run = await db.query.migrationRuns.findFirst({
    where: eq(migrationRuns.id, runId),
    columns: {
      id: true,
      environmentId: true,
      databaseId: true,
      executionGeneration: true,
    },
  });
  if (!run) throw new Error(`Migration run ${runId} not found`);
  if (!run.executionGeneration) throw new Error(`Migration run ${runId} has no execution fence`);
  const fence = {
    scopeKey: buildMigrationExecutionKey(run.environmentId, run.databaseId),
    ownerId: run.id,
    generation: run.executionGeneration,
  };
  await assertExecutionFence(db, fence);
  return fence;
}

export async function assertExecutionFence(
  executor: Pick<typeof db, 'select'>,
  fence: ExecutionFence
): Promise<void> {
  if (!(await isExecutionFenceCurrent(executor, fence))) {
    throw new ExecutionFenceLostError(fence);
  }
}
