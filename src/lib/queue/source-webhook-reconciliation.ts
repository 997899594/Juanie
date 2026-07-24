import { Cron } from 'croner';
import { and, desc, eq, inArray, isNull, like, lt, lte, notLike, or } from 'drizzle-orm';
import { getCiRuntimeDescriptor } from '@/lib/ci/runtime-assets';
import { db } from '@/lib/db';
import { deliveryExecutions, projects, repositoryWebhookControllers } from '@/lib/db/schema';
import { logger } from '@/lib/logger';
import { enqueueOutboxMessage } from '@/lib/outbox/service';
import { acceptSourceDelivery } from '@/lib/source-deliveries/service';
import { ensureRepositoryWebhookDesiredState } from '@/lib/source-deliveries/webhook-controller';

const schedule = process.env.SOURCE_WEBHOOK_RECONCILIATION_SCHEDULE?.trim() || '17 */6 * * *';
const batchSize = 100;
const reconciliationLogger = logger.child({ component: 'source-webhook-reconciliation' });
let running = false;
let tickRunning = false;

async function enqueueDueWebhookControllers(): Promise<number> {
  const due = await db.query.repositoryWebhookControllers.findMany({
    where: or(
      inArray(repositoryWebhookControllers.status, ['pending', 'drifted']),
      and(
        eq(repositoryWebhookControllers.status, 'failed'),
        or(
          isNull(repositoryWebhookControllers.retryAt),
          lte(repositoryWebhookControllers.retryAt, new Date())
        )
      ),
      and(
        eq(repositoryWebhookControllers.status, 'reconciling'),
        lt(repositoryWebhookControllers.updatedAt, new Date(Date.now() - 15 * 60 * 1000))
      )
    ),
    orderBy: (controller, { asc }) => [asc(controller.retryAt), asc(controller.updatedAt)],
    limit: batchSize,
  });
  for (const controller of due) {
    await enqueueOutboxMessage(db, {
      topic: 'source.webhook.reconcile.requested',
      aggregateType: 'repositoryWebhookController',
      aggregateId: controller.repositoryId,
      commandId: `generation-${controller.desiredGeneration}-attempt-${controller.attemptCount}`,
      payload: { desiredGeneration: controller.desiredGeneration },
    });
  }
  return due.length;
}

async function enqueueSyntheticDeliveryCanary(): Promise<boolean> {
  const latestCanary = await db.query.deliveryExecutions.findFirst({
    where: like(deliveryExecutions.providerDeliveryId, 'juanie-canary:%'),
    orderBy: [desc(deliveryExecutions.createdAt)],
  });
  if (latestCanary && latestCanary.createdAt > new Date(Date.now() - 6 * 60 * 60 * 1000)) {
    return false;
  }
  const source = await db.query.deliveryExecutions.findFirst({
    where: notLike(deliveryExecutions.providerDeliveryId, 'juanie-canary:%'),
    orderBy: [desc(deliveryExecutions.createdAt)],
    with: {
      project: { columns: { status: true } },
    },
  });
  if (source?.project.status !== 'active') return false;
  const bucket = Math.floor(Date.now() / (6 * 60 * 60 * 1000));
  await acceptSourceDelivery({
    projectId: source.projectId,
    repositoryId: source.repositoryId,
    provider: source.provider,
    providerDeliveryId: `juanie-canary:${source.projectId}:${bucket}`,
    sourceRepository: source.sourceRepository,
    sourceRef: source.sourceRef,
    beforeCommitSha: source.sourceCommitSha,
    sourceCommitSha: source.sourceCommitSha,
    forceFullBuild: false,
  });
  return true;
}

export async function reconcileSourceWebhooks(): Promise<{
  checked: number;
  queued: number;
  canaryQueued: boolean;
}> {
  const canonicalUrl = `${getCiRuntimeDescriptor().baseUrl}/api/webhooks/source`;
  const activeProjects = await db.query.projects.findMany({
    where: eq(projects.status, 'active'),
    columns: { repositoryId: true },
    limit: 10_000,
  });
  const repositoryIds = [
    ...new Set(
      activeProjects
        .map((project) => project.repositoryId)
        .filter((repositoryId): repositoryId is string => Boolean(repositoryId))
    ),
  ];
  for (const repositoryId of repositoryIds) {
    await ensureRepositoryWebhookDesiredState({ repositoryId, canonicalUrl });
  }
  const [queued, canaryQueued] = await Promise.all([
    enqueueDueWebhookControllers(),
    enqueueSyntheticDeliveryCanary(),
  ]);
  return { checked: repositoryIds.length, queued, canaryQueued };
}

export function startSourceWebhookReconciliation(): void {
  if (running) return;
  running = true;
  const tick = async () => {
    if (tickRunning) return;
    tickRunning = true;
    try {
      reconciliationLogger.info(
        'Source webhook controller scheduling completed',
        await reconcileSourceWebhooks()
      );
    } catch (error) {
      reconciliationLogger.error('Source webhook controller scheduling failed', error);
    } finally {
      tickRunning = false;
    }
  };
  void tick();
  new Cron(schedule, tick);
  reconciliationLogger.info('Source webhook controller scheduler started', { schedule, batchSize });
}
