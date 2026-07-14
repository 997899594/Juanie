import { and, asc, eq, isNull, lte, or, sql } from 'drizzle-orm';
import { db } from '@/lib/db';
import { aiTasks } from '@/lib/db/schema';
import { logger } from '@/lib/logger';
import { addAITaskJob } from '@/lib/queue';

const DEFAULT_BATCH_SIZE = 100;
const aiTaskReconcilerLogger = logger.child({ component: 'ai-task-reconciler' });

export interface AITaskReconciliationResult {
  discovered: number;
  dispatched: number;
  failed: number;
}

export async function dispatchPersistedAITask(input: {
  taskId: string;
  kind: typeof aiTasks.$inferSelect.kind;
  enqueueTask?: typeof addAITaskJob;
}): Promise<void> {
  await (input.enqueueTask ?? addAITaskJob)(input.taskId, input.kind);
  await db
    .update(aiTasks)
    .set({
      dispatchAttemptCount: sql`${aiTasks.dispatchAttemptCount} + 1`,
      lastDispatchedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(aiTasks.id, input.taskId));
}

export async function reconcileAITasks(input?: {
  now?: Date;
  batchSize?: number;
  enqueueTask?: typeof addAITaskJob;
}): Promise<AITaskReconciliationResult> {
  const now = input?.now ?? new Date();
  const tasks = await db.query.aiTasks.findMany({
    where: or(
      eq(aiTasks.status, 'queued'),
      and(
        eq(aiTasks.status, 'running'),
        or(isNull(aiTasks.leaseExpiresAt), lte(aiTasks.leaseExpiresAt, now))
      )
    ),
    orderBy: [asc(aiTasks.createdAt)],
    limit: input?.batchSize ?? DEFAULT_BATCH_SIZE,
    columns: { id: true, kind: true },
  });

  const results = await Promise.allSettled(
    tasks.map((task) =>
      dispatchPersistedAITask({
        taskId: task.id,
        kind: task.kind,
        enqueueTask: input?.enqueueTask,
      })
    )
  );
  const failed = results.filter((result) => result.status === 'rejected').length;
  if (failed > 0) {
    aiTaskReconcilerLogger.warn('Some persisted AI tasks could not be dispatched', {
      discovered: tasks.length,
      failed,
    });
  }

  return {
    discovered: tasks.length,
    dispatched: tasks.length - failed,
    failed,
  };
}
