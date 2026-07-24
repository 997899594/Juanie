import { and, eq, sql } from 'drizzle-orm';
import { db } from '@/lib/db';
import {
  type DeliveryExecutionStatus,
  deliveryExecutionEvents,
  deliveryExecutions,
} from '@/lib/db/schema';
import { assertDeliveryExecutionTransition } from '@/lib/delivery-executions/state-machine';

export interface DeliveryExecutionSignal {
  executionId: string;
  eventKey: string;
  type: string;
  status: DeliveryExecutionStatus;
  data?: Record<string, unknown>;
  errorCode?: string | null;
  errorMessage?: string | null;
}

type DatabaseTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

export async function findDeliveryExecutionForProviderRun(input: {
  repositoryId: string;
  provider: string;
  providerDeliveryId: string | null | undefined;
}) {
  if (!input.providerDeliveryId) return null;
  return db.query.deliveryExecutions.findFirst({
    where: and(
      eq(deliveryExecutions.repositoryId, input.repositoryId),
      eq(deliveryExecutions.providerDeliveryId, input.providerDeliveryId),
      eq(
        deliveryExecutions.provider,
        input.provider as typeof deliveryExecutions.$inferSelect.provider
      )
    ),
  });
}

export async function signalDeliveryExecutionInTransaction(
  tx: DatabaseTransaction,
  input: DeliveryExecutionSignal
) {
  await tx.execute(
    sql`select 1 from ${deliveryExecutions} where ${deliveryExecutions.id} = ${input.executionId} for update`
  );
  const execution = await tx.query.deliveryExecutions.findFirst({
    where: eq(deliveryExecutions.id, input.executionId),
  });
  if (!execution) throw new Error(`Delivery execution ${input.executionId} does not exist`);

  const existingEvent = await tx.query.deliveryExecutionEvents.findFirst({
    where: and(
      eq(deliveryExecutionEvents.deliveryExecutionId, input.executionId),
      eq(deliveryExecutionEvents.eventKey, input.eventKey)
    ),
  });
  if (existingEvent) return execution;

  assertDeliveryExecutionTransition(execution.status, input.status);
  const now = new Date();
  const [updated] = await tx
    .update(deliveryExecutions)
    .set({
      status: input.status,
      lastSignalAt: now,
      lastErrorCode: input.errorCode?.slice(0, 100) ?? null,
      lastError: input.errorMessage?.slice(0, 10_000) ?? null,
      completedAt: ['production_verified', 'failed', 'canceled'].includes(input.status)
        ? now
        : null,
      updatedAt: now,
    })
    .where(eq(deliveryExecutions.id, input.executionId))
    .returning();
  if (!updated) throw new Error(`Delivery execution ${input.executionId} disappeared`);

  await tx.insert(deliveryExecutionEvents).values({
    deliveryExecutionId: input.executionId,
    eventKey: input.eventKey,
    type: input.type,
    fromStatus: execution.status,
    toStatus: input.status,
    data: input.data ?? {},
    occurredAt: now,
  });
  return updated;
}

export async function signalDeliveryExecution(input: DeliveryExecutionSignal) {
  return db.transaction((tx) => signalDeliveryExecutionInTransaction(tx, input));
}
