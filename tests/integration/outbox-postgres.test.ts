import { describe, expect, it } from 'bun:test';
import { randomUUID } from 'node:crypto';
import { eq, sql } from 'drizzle-orm';
import { closeDb, db } from '@/lib/db';
import { outboxMessages, projects, teams, users } from '@/lib/db/schema';
import {
  claimOutboxMessages,
  closeOutboxDispatcherStore,
  dispatchOutboxBatch,
  dispatchOutboxMessage,
} from '@/lib/outbox/dispatcher';
import { OutboxOperationConflictError, replayDeadLetterMessage } from '@/lib/outbox/operations';
import { enqueueOutboxMessage } from '@/lib/outbox/service';

const integrationEnabled = process.env.INTEGRATION_TESTS === 'true';
const restateIntegrationEnabled =
  integrationEnabled && process.env.RESTATE_INTEGRATION_TESTS === 'true';
const integrationTest = integrationEnabled ? it : it.skip;
const restateIntegrationTest = restateIntegrationEnabled ? it : it.skip;

async function waitFor(
  predicate: () => Promise<boolean>,
  timeoutMs = 20_000,
  intervalMs = 100
): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await predicate()) return;
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
  throw new Error(`Condition was not met within ${timeoutMs}ms`);
}

describe('transactional outbox with PostgreSQL', () => {
  integrationTest(
    'deduplicates concurrent command writes and recovers an abandoned claim',
    async () => {
      const aggregateId = randomUUID();
      const commandId = randomUUID();
      const input = {
        topic: 'environment.runtime.requested' as const,
        aggregateType: 'environment',
        aggregateId,
        commandId,
        payload: { action: 'wake', projectId: randomUUID() },
      };

      try {
        const rows = await Promise.all([
          enqueueOutboxMessage(db, input),
          enqueueOutboxMessage(db, input),
          enqueueOutboxMessage(db, input),
        ]);
        expect(new Set(rows.map((row) => row.id)).size).toBe(1);

        const claimed = await claimOutboxMessages();
        const message = claimed.find((candidate) => candidate.aggregateId === aggregateId);
        expect(message?.attemptCount).toBe(1);

        await db.execute(sql`
        update "outboxMessage"
        set "claimedAt" = now() - interval '3 minutes'
        where id = ${message?.id ?? ''}
      `);
        const reclaimed = await claimOutboxMessages();
        expect(reclaimed.find((candidate) => candidate.id === message?.id)?.attemptCount).toBe(2);
      } finally {
        await db.delete(outboxMessages).where(eq(outboxMessages.aggregateId, aggregateId));
        await closeOutboxDispatcherStore();
        await closeDb();
      }
    }
  );

  integrationTest(
    'replays dead letters as new immutable attempts with operator lineage',
    async () => {
      const aggregateId = randomUUID();
      const operatorUserId = randomUUID();

      try {
        await db.insert(users).values({
          id: operatorUserId,
          email: `${operatorUserId}@example.test`,
          platformRole: 'operator',
        });
        const original = await enqueueOutboxMessage(db, {
          topic: 'project.delete.requested',
          aggregateType: 'project',
          aggregateId,
          commandId: randomUUID(),
          payload: {},
        });
        await db
          .update(outboxMessages)
          .set({ status: 'dead_letter', lastError: 'terminal test failure' })
          .where(eq(outboxMessages.id, original.id));

        const replay = await replayDeadLetterMessage({
          messageId: original.id,
          operatorUserId,
          note: 'integration replay',
        });
        expect(replay.status).toBe('pending');
        expect(replay.replayedFromId).toBe(original.id);
        expect(replay.createdByUserId).toBe(operatorUserId);

        const resolved = await db.query.outboxMessages.findFirst({
          where: eq(outboxMessages.id, original.id),
        });
        expect(resolved?.replayMessageId).toBe(replay.id);
        expect(resolved?.resolvedByUserId).toBe(operatorUserId);

        let conflict: unknown;
        try {
          await replayDeadLetterMessage({ messageId: original.id, operatorUserId });
        } catch (error) {
          conflict = error;
        }
        expect(conflict instanceof OutboxOperationConflictError).toBe(true);
      } finally {
        await db.delete(outboxMessages).where(eq(outboxMessages.aggregateId, aggregateId));
        await db.delete(users).where(eq(users.id, operatorUserId));
        await closeOutboxDispatcherStore();
        await closeDb();
      }
    }
  );

  restateIntegrationTest(
    'projects a real Restate workflow result back into PostgreSQL',
    async () => {
      const teamId = randomUUID();
      const projectId = randomUUID();
      const commandId = randomUUID();
      const slug = `restate-delete-${projectId}`;

      try {
        await db.transaction(async (tx) => {
          await tx.insert(teams).values({ id: teamId, name: slug, slug });
          await tx.insert(projects).values({
            id: projectId,
            teamId,
            name: slug,
            slug,
            status: 'deleting',
          });
          await enqueueOutboxMessage(tx, {
            topic: 'project.delete.requested',
            aggregateType: 'project',
            aggregateId: projectId,
            commandId,
            payload: { deletionAttemptId: commandId },
          });
        });

        expect(await dispatchOutboxBatch()).toBe(1);
        await waitFor(async () => {
          const project = await db.query.projects.findFirst({
            where: eq(projects.id, projectId),
            columns: { id: true },
          });
          return project === undefined;
        });

        const [message] = await db
          .select()
          .from(outboxMessages)
          .where(eq(outboxMessages.aggregateId, projectId));
        expect(message?.status).toBe('delivered');

        await dispatchOutboxMessage(
          {
            id: message.id,
            topic: 'project.delete.requested',
            aggregateId: projectId,
            commandId,
            payload: { deletionAttemptId: commandId },
            attemptCount: message.attemptCount,
          },
          { ingressUrl: process.env.RESTATE_INGRESS_URL }
        );
        expect(
          await db.query.projects.findFirst({
            where: eq(projects.id, projectId),
            columns: { id: true },
          })
        ).toBeUndefined();
      } finally {
        await db.delete(outboxMessages).where(eq(outboxMessages.aggregateId, projectId));
        await db.delete(projects).where(eq(projects.id, projectId));
        await db.delete(teams).where(eq(teams.id, teamId));
        await closeOutboxDispatcherStore();
        await closeDb();
      }
    }
  );
});
