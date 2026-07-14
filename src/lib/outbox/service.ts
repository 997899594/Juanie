import { db } from '@/lib/db';
import { outboxMessages } from '@/lib/db/schema';
import type { NewOutboxMessage, OutboxMessageInput } from '@/lib/outbox/types';

type OutboxExecutor = Pick<typeof db, 'insert'>;

function assertIdentityPart(name: string, value: string): string {
  const normalized = value.trim();
  if (!normalized) {
    throw new Error(`Outbox ${name} must not be empty`);
  }
  if (normalized.includes(':')) {
    throw new Error(`Outbox ${name} must not contain ':'`);
  }
  return normalized;
}

export function buildOutboxMessage(input: OutboxMessageInput): NewOutboxMessage {
  const topic = assertIdentityPart('topic', input.topic);
  const aggregateType = assertIdentityPart('aggregateType', input.aggregateType);
  const aggregateId = assertIdentityPart('aggregateId', input.aggregateId);
  const commandId = assertIdentityPart('commandId', input.commandId);

  return {
    ...input,
    topic: input.topic,
    aggregateType,
    aggregateId,
    commandId,
    dedupeKey: `${topic}:${aggregateType}:${aggregateId}:${commandId}`,
    status: 'pending',
  };
}

export async function enqueueOutboxMessage(
  executor: OutboxExecutor,
  input: OutboxMessageInput
): Promise<typeof outboxMessages.$inferSelect> {
  const message = buildOutboxMessage(input);
  const [row] = await executor
    .insert(outboxMessages)
    .values(message)
    .onConflictDoUpdate({
      target: outboxMessages.dedupeKey,
      set: {
        availableAt: message.availableAt ?? new Date(),
        updatedAt: new Date(),
      },
    })
    .returning();

  if (!row) {
    throw new Error('Failed to persist outbox message');
  }

  return row;
}
