import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { type ReleaseStatus, releaseEvents, releaseStatuses, releases } from '@/lib/db/schema';

export const releaseEventTypes = [
  'release.created',
  'release.status.changed',
  'release.approval.requested',
  'release.approval.received',
  'release.rollout.requested',
  'release.rollout.received',
  'release.failed',
  'release.completed',
] as const;

export type ReleaseEventType = (typeof releaseEventTypes)[number];

export interface ReleaseEventInput {
  releaseId: string;
  projectId: string;
  environmentId: string;
  actorUserId?: string | null;
  eventKey: string;
  type: ReleaseEventType;
  data: Record<string, unknown>;
  correlationId: string;
  causationId?: string | null;
  occurredAt?: Date;
}

export type NewReleaseEvent = ReturnType<typeof buildReleaseEvent>;
type ReleaseEventExecutor = Pick<typeof db, 'insert' | 'update'>;

function requireText(field: string, value: string): string {
  const normalized = value.trim();
  if (!normalized) {
    throw new Error(`Release event ${field} must not be empty`);
  }
  return normalized;
}

export function buildReleaseEvent(input: ReleaseEventInput) {
  return {
    releaseId: requireText('releaseId', input.releaseId),
    projectId: requireText('projectId', input.projectId),
    environmentId: requireText('environmentId', input.environmentId),
    actorUserId: input.actorUserId ?? null,
    eventKey: requireText('eventKey', input.eventKey),
    type: input.type,
    data: input.data,
    correlationId: requireText('correlationId', input.correlationId),
    causationId: input.causationId ?? null,
    ...(input.occurredAt ? { occurredAt: input.occurredAt } : {}),
  };
}

export function projectReleaseStatus(
  currentStatus: ReleaseStatus,
  event: Pick<NewReleaseEvent, 'type' | 'data'>
): ReleaseStatus {
  if (event.type !== 'release.status.changed') {
    return currentStatus;
  }

  const nextStatus = event.data.to;
  if (typeof nextStatus !== 'string' || !releaseStatuses.includes(nextStatus as ReleaseStatus)) {
    throw new Error(`Unknown release status: ${String(nextStatus)}`);
  }

  return nextStatus as ReleaseStatus;
}

export async function appendReleaseEvent(
  executor: ReleaseEventExecutor,
  input: ReleaseEventInput,
  currentStatus?: ReleaseStatus
): Promise<typeof releaseEvents.$inferSelect> {
  const event = buildReleaseEvent(input);
  const [row] = await executor
    .insert(releaseEvents)
    .values(event)
    .onConflictDoNothing({
      target: [releaseEvents.releaseId, releaseEvents.eventKey],
    })
    .returning();

  if (currentStatus) {
    const nextStatus = projectReleaseStatus(currentStatus, event);
    if (nextStatus !== currentStatus) {
      await executor
        .update(releases)
        .set({ status: nextStatus, updatedAt: new Date() })
        .where(eq(releases.id, input.releaseId));
    }
  }

  if (row) {
    return row;
  }

  const existing = await db.query.releaseEvents.findFirst({
    where: (table, { and, eq }) =>
      and(eq(table.releaseId, input.releaseId), eq(table.eventKey, input.eventKey)),
  });
  if (!existing) {
    throw new Error('Failed to append release event');
  }
  return existing;
}
