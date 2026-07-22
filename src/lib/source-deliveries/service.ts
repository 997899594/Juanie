import { and, eq, sql } from 'drizzle-orm';
import { dispatchApplicationDelivery } from '@/lib/ci/application-delivery';
import { db } from '@/lib/db';
import { type GitProviderType, type SourceDeliveryStatus, sourceDeliveries } from '@/lib/db/schema';
import { logger } from '@/lib/logger';
import { enqueueOutboxMessage } from '@/lib/outbox/service';

const sourceDeliveryLogger = logger.child({ component: 'source-delivery' });

export interface AcceptSourceDeliveryInput {
  projectId: string;
  repositoryId: string;
  provider: GitProviderType;
  providerDeliveryId: string;
  sourceRepository: string;
  sourceRef: string;
  beforeCommitSha: string | null;
  sourceCommitSha: string;
  forceFullBuild: boolean;
}

export interface AcceptedSourceDelivery {
  delivery: typeof sourceDeliveries.$inferSelect;
  created: boolean;
  requeued: boolean;
}

export async function acceptSourceDelivery(
  input: AcceptSourceDeliveryInput
): Promise<AcceptedSourceDelivery> {
  return db.transaction(async (tx) => {
    const [created] = await tx
      .insert(sourceDeliveries)
      .values({
        ...input,
        status: 'received',
      })
      .onConflictDoNothing({
        target: [sourceDeliveries.provider, sourceDeliveries.providerDeliveryId],
      })
      .returning();

    if (created) {
      await enqueueOutboxMessage(tx, {
        topic: 'source.delivery.requested',
        aggregateType: 'sourceDelivery',
        aggregateId: created.id,
        commandId: 'dispatch-1',
        payload: {},
      });
      return { delivery: created, created: true, requeued: false };
    }

    const existing = await tx.query.sourceDeliveries.findFirst({
      where: and(
        eq(sourceDeliveries.provider, input.provider),
        eq(sourceDeliveries.providerDeliveryId, input.providerDeliveryId)
      ),
    });
    if (!existing) {
      throw new Error('Source delivery deduplication conflict did not resolve to an aggregate');
    }
    if (existing.status !== 'failed') {
      return { delivery: existing, created: false, requeued: false };
    }

    const [requeued] = await tx
      .update(sourceDeliveries)
      .set({
        status: 'received',
        lastError: null,
        updatedAt: new Date(),
      })
      .where(and(eq(sourceDeliveries.id, existing.id), eq(sourceDeliveries.status, 'failed')))
      .returning();
    if (!requeued) {
      const current = await tx.query.sourceDeliveries.findFirst({
        where: eq(sourceDeliveries.id, existing.id),
      });
      if (!current) throw new Error(`Source delivery ${existing.id} disappeared during redelivery`);
      return { delivery: current, created: false, requeued: false };
    }

    await enqueueOutboxMessage(tx, {
      topic: 'source.delivery.requested',
      aggregateType: 'sourceDelivery',
      aggregateId: requeued.id,
      commandId: `dispatch-${requeued.attemptCount + 1}`,
      payload: {},
    });
    return { delivery: requeued, created: false, requeued: true };
  });
}

export async function beginSourceDeliveryDispatch(
  deliveryId: string
): Promise<typeof sourceDeliveries.$inferSelect> {
  return db.transaction(async (tx) => {
    const existing = await tx.query.sourceDeliveries.findFirst({
      where: eq(sourceDeliveries.id, deliveryId),
    });
    if (!existing) throw new Error(`Source delivery ${deliveryId} does not exist`);
    if (existing.status === 'dispatched') return existing;

    const [delivery] = await tx
      .update(sourceDeliveries)
      .set({
        status: 'dispatching',
        attemptCount: sql`${sourceDeliveries.attemptCount} + 1`,
        lastError: null,
        updatedAt: new Date(),
      })
      .where(eq(sourceDeliveries.id, deliveryId))
      .returning();
    if (!delivery) throw new Error(`Source delivery ${deliveryId} disappeared during dispatch`);
    return delivery;
  });
}

export async function dispatchAcceptedSourceDelivery(
  delivery: typeof sourceDeliveries.$inferSelect
): Promise<void> {
  await dispatchApplicationDelivery({
    provider: delivery.provider,
    repository: delivery.sourceRepository,
    sourceRef: delivery.sourceRef,
    sourceCommitSha: delivery.sourceCommitSha,
    beforeCommitSha: delivery.beforeCommitSha,
    deliveryId: delivery.providerDeliveryId,
    forceFullBuild: delivery.forceFullBuild,
  });
}

async function projectSourceDeliveryStatus(input: {
  deliveryId: string;
  status: Extract<SourceDeliveryStatus, 'dispatched' | 'failed'>;
  error?: string;
}): Promise<void> {
  const [updated] = await db
    .update(sourceDeliveries)
    .set({
      status: input.status,
      lastError: input.error?.slice(0, 10_000) ?? null,
      dispatchedAt: input.status === 'dispatched' ? new Date() : null,
      updatedAt: new Date(),
    })
    .where(eq(sourceDeliveries.id, input.deliveryId))
    .returning({ id: sourceDeliveries.id });
  if (!updated) throw new Error(`Source delivery ${input.deliveryId} does not exist`);
}

export async function completeSourceDeliveryDispatch(deliveryId: string): Promise<void> {
  await projectSourceDeliveryStatus({ deliveryId, status: 'dispatched' });
  sourceDeliveryLogger.info('Source delivery dispatched', { sourceDeliveryId: deliveryId });
}

export async function failSourceDeliveryDispatch(deliveryId: string, error: string): Promise<void> {
  await projectSourceDeliveryStatus({ deliveryId, status: 'failed', error });
  sourceDeliveryLogger.error('Source delivery dispatch failed', {
    sourceDeliveryId: deliveryId,
    errorMessage: error,
  });
}
