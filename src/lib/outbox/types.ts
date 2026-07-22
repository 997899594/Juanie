import type { OutboxStatus } from '@/lib/db/schema';

export const outboxTopics = [
  'project.init.requested',
  'project.init.retry.requested',
  'project.delete.requested',
  'release.requested',
  'release.rollout.requested',
  'migration.requested',
  'schema.repair.requested',
  'environment.runtime.requested',
  'deployment.requested',
  'source.delivery.requested',
] as const;

export type OutboxTopic = (typeof outboxTopics)[number];

export function isOutboxTopic(value: string): value is OutboxTopic {
  return outboxTopics.some((topic) => topic === value);
}

export interface OutboxMessageInput {
  topic: OutboxTopic;
  aggregateType: string;
  aggregateId: string;
  commandId: string;
  payload: Record<string, unknown>;
  availableAt?: Date;
}

export interface NewOutboxMessage extends OutboxMessageInput {
  dedupeKey: string;
  status: Extract<OutboxStatus, 'pending'>;
}
