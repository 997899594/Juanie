import { randomUUID } from 'node:crypto';
import { and, desc, eq, isNotNull, isNull, lt } from 'drizzle-orm';
import { db } from '@/lib/db';
import { outboxMessages } from '@/lib/db/schema';
import { buildOutboxMessage } from '@/lib/outbox/service';
import { isOutboxTopic } from '@/lib/outbox/types';

export class OutboxOperationConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'OutboxOperationConflictError';
  }
}

export async function listDeadLetterMessages(input?: {
  limit?: number;
  resolved?: boolean;
}): Promise<(typeof outboxMessages.$inferSelect)[]> {
  const resolvedCondition = input?.resolved
    ? isNotNull(outboxMessages.resolvedAt)
    : isNull(outboxMessages.resolvedAt);
  return db.query.outboxMessages.findMany({
    where: and(eq(outboxMessages.status, 'dead_letter'), resolvedCondition),
    orderBy: [desc(outboxMessages.createdAt)],
    limit: Math.min(Math.max(input?.limit ?? 50, 1), 200),
  });
}

export async function replayDeadLetterMessage(input: {
  messageId: string;
  operatorUserId: string;
  note?: string | null;
}): Promise<typeof outboxMessages.$inferSelect> {
  const replayId = randomUUID();
  const replayCommandId = `replay-${randomUUID()}`;

  return db.transaction(async (tx) => {
    const [original] = await tx
      .select()
      .from(outboxMessages)
      .where(
        and(
          eq(outboxMessages.id, input.messageId),
          eq(outboxMessages.status, 'dead_letter'),
          isNull(outboxMessages.resolvedAt)
        )
      );

    if (!original) {
      throw new OutboxOperationConflictError('Dead-letter message is missing or already resolved');
    }
    if (!isOutboxTopic(original.topic)) {
      throw new OutboxOperationConflictError(`Unsupported outbox topic: ${original.topic}`);
    }

    const replay = buildOutboxMessage({
      topic: original.topic,
      aggregateType: original.aggregateType,
      aggregateId: original.aggregateId,
      commandId: replayCommandId,
      payload: {
        ...original.payload,
        replayOf: original.id,
        originalCommandId: original.commandId,
      },
    });
    const [created] = await tx
      .insert(outboxMessages)
      .values({
        ...replay,
        id: replayId,
        replayedFromId: original.id,
        createdByUserId: input.operatorUserId,
      })
      .returning();

    if (!created) throw new Error('Failed to create outbox replay attempt');
    const [resolved] = await tx
      .update(outboxMessages)
      .set({
        resolvedAt: new Date(),
        resolvedByUserId: input.operatorUserId,
        resolutionNote: input.note?.trim() || 'Replayed by platform operator',
        replayMessageId: replayId,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(outboxMessages.id, input.messageId),
          eq(outboxMessages.status, 'dead_letter'),
          isNull(outboxMessages.resolvedAt)
        )
      )
      .returning({ id: outboxMessages.id });
    if (!resolved) {
      throw new OutboxOperationConflictError('Dead-letter message was resolved concurrently');
    }
    return created;
  });
}

export async function cleanupOutboxHistory(input: {
  deliveredBefore: Date;
  resolvedDeadLettersBefore: Date;
}): Promise<{ deletedDelivered: number; deletedResolvedDeadLetters: number }> {
  const [delivered, deadLetters] = await db.transaction(async (tx) => {
    const deletedDelivered = await tx
      .delete(outboxMessages)
      .where(
        and(
          eq(outboxMessages.status, 'delivered'),
          lt(outboxMessages.deliveredAt, input.deliveredBefore),
          isNull(outboxMessages.replayedFromId)
        )
      )
      .returning({ id: outboxMessages.id });
    const deletedResolvedDeadLetters = await tx
      .delete(outboxMessages)
      .where(
        and(
          eq(outboxMessages.status, 'dead_letter'),
          isNotNull(outboxMessages.resolvedAt),
          lt(outboxMessages.resolvedAt, input.resolvedDeadLettersBefore)
        )
      )
      .returning({ id: outboxMessages.id });
    return [deletedDelivered.length, deletedResolvedDeadLetters.length] as const;
  });

  return { deletedDelivered: delivered, deletedResolvedDeadLetters: deadLetters };
}
