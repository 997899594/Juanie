import { and, eq, sql } from 'drizzle-orm';
import { dispatchApplicationDelivery } from '@/lib/ci/application-delivery';
import { db } from '@/lib/db';
import {
  deliveryExecutionEvents,
  deliveryExecutions,
  type GitProviderType,
  type SourceDeliveryStatus,
  sourceDeliveries,
} from '@/lib/db/schema';
import {
  signalDeliveryExecution,
  signalDeliveryExecutionInTransaction,
} from '@/lib/delivery-executions/service';
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
    const [execution] = await tx
      .insert(deliveryExecutions)
      .values({
        projectId: input.projectId,
        repositoryId: input.repositoryId,
        provider: input.provider,
        providerDeliveryId: input.providerDeliveryId,
        sourceRepository: input.sourceRepository,
        sourceRef: input.sourceRef,
        sourceCommitSha: input.sourceCommitSha,
        status: 'received',
      })
      .onConflictDoNothing({
        target: [deliveryExecutions.provider, deliveryExecutions.providerDeliveryId],
      })
      .returning();
    const resolvedExecution =
      execution ??
      (await tx.query.deliveryExecutions.findFirst({
        where: and(
          eq(deliveryExecutions.provider, input.provider),
          eq(deliveryExecutions.providerDeliveryId, input.providerDeliveryId)
        ),
      }));
    if (!resolvedExecution) {
      throw new Error('Delivery execution deduplication did not resolve to an aggregate');
    }

    const [created] = await tx
      .insert(sourceDeliveries)
      .values({
        ...input,
        deliveryExecutionId: resolvedExecution.id,
        status: 'received',
      })
      .onConflictDoNothing({
        target: [sourceDeliveries.provider, sourceDeliveries.providerDeliveryId],
      })
      .returning();

    if (created) {
      await tx
        .insert(deliveryExecutionEvents)
        .values({
          deliveryExecutionId: resolvedExecution.id,
          eventKey: 'source.received',
          type: 'source.received',
          fromStatus: null,
          toStatus: 'received',
          data: {
            providerDeliveryId: input.providerDeliveryId,
            sourceCommitSha: input.sourceCommitSha,
          },
        })
        .onConflictDoNothing();
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
    return { delivery: existing, created: false, requeued: false };
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
    await signalDeliveryExecutionInTransaction(tx, {
      executionId: delivery.deliveryExecutionId,
      eventKey: `source.dispatching.${delivery.attemptCount}`,
      type: 'source.dispatching',
      status: 'dispatching',
      data: { attemptCount: delivery.attemptCount },
    });
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
  const delivery = await db.query.sourceDeliveries.findFirst({
    where: eq(sourceDeliveries.id, deliveryId),
  });
  if (!delivery) throw new Error(`Source delivery ${deliveryId} does not exist`);
  await projectSourceDeliveryStatus({ deliveryId, status: 'dispatched' });
  sourceDeliveryLogger.info('Source delivery dispatched', { sourceDeliveryId: deliveryId });
}

export async function failSourceDeliveryDispatch(deliveryId: string, error: string): Promise<void> {
  const delivery = await db.query.sourceDeliveries.findFirst({
    where: eq(sourceDeliveries.id, deliveryId),
  });
  if (!delivery) throw new Error(`Source delivery ${deliveryId} does not exist`);
  await projectSourceDeliveryStatus({ deliveryId, status: 'failed', error });
  await signalDeliveryExecution({
    executionId: delivery.deliveryExecutionId,
    eventKey: 'source.dispatch.failed',
    type: 'source.dispatch.failed',
    status: 'failed',
    errorCode: 'SOURCE_DISPATCH_FAILED',
    errorMessage: error,
  });
  sourceDeliveryLogger.error('Source delivery dispatch failed', {
    sourceDeliveryId: deliveryId,
    errorMessage: error,
  });
}
