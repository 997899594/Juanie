import { describe, expect, it } from 'bun:test';
import { randomUUID } from 'node:crypto';
import { eq, inArray } from 'drizzle-orm';
import { reconcileAITasks } from '@/lib/ai/tasks/reconciler';
import { closeDb, db } from '@/lib/db';
import { aiTasks, teams } from '@/lib/db/schema';

const enabled = process.env.INTEGRATION_TESTS === 'true';
const integrationTest = enabled ? it : it.skip;

describe('PostgreSQL-backed AI task reconciliation', () => {
  integrationTest('rebuilds queued and stale tasks while respecting active leases', async () => {
    const teamId = randomUUID();
    const now = new Date('2026-07-14T04:00:00.000Z');
    const queuedId = randomUUID();
    const staleId = randomUUID();
    const activeId = randomUUID();
    const dispatched: string[] = [];

    try {
      await db.insert(teams).values({ id: teamId, name: teamId, slug: teamId });
      await db.insert(aiTasks).values([
        {
          id: queuedId,
          teamId,
          kind: 'environment_deep_analysis',
          status: 'queued',
          title: 'queued',
          inputSummary: 'queued',
        },
        {
          id: staleId,
          teamId,
          kind: 'release_deep_analysis',
          status: 'running',
          title: 'stale',
          inputSummary: 'stale',
          leaseToken: randomUUID(),
          leaseExpiresAt: new Date(now.getTime() - 1),
        },
        {
          id: activeId,
          teamId,
          kind: 'release_deep_analysis',
          status: 'running',
          title: 'active',
          inputSummary: 'active',
          leaseToken: randomUUID(),
          leaseExpiresAt: new Date(now.getTime() + 60_000),
        },
      ]);

      const result = await reconcileAITasks({
        now,
        enqueueTask: async (taskId) => {
          dispatched.push(taskId);
          return {} as Awaited<ReturnType<typeof import('@/lib/queue').addAITaskJob>>;
        },
      });

      expect(result).toEqual({ discovered: 2, dispatched: 2, failed: 0 });
      expect(new Set(dispatched)).toEqual(new Set([queuedId, staleId]));
      const records = await db.query.aiTasks.findMany({
        where: inArray(aiTasks.id, [queuedId, staleId, activeId]),
        columns: { id: true, dispatchAttemptCount: true },
      });
      expect(records.find((task) => task.id === queuedId)?.dispatchAttemptCount).toBe(1);
      expect(records.find((task) => task.id === staleId)?.dispatchAttemptCount).toBe(1);
      expect(records.find((task) => task.id === activeId)?.dispatchAttemptCount).toBe(0);
    } finally {
      await db.delete(aiTasks).where(eq(aiTasks.teamId, teamId));
      await db.delete(teams).where(eq(teams.id, teamId));
      await closeDb();
    }
  });
});
