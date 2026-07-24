import { and, eq } from 'drizzle-orm';
import { getCiRuntimeDescriptor } from '@/lib/ci/runtime-assets';
import { db } from '@/lib/db';
import { repositories, repositoryWebhookControllers } from '@/lib/db/schema';
import { getTeamIntegrationSession } from '@/lib/integrations/service/integration-control-plane';
import { reconcileRepositorySourceWebhook } from '@/lib/source-deliveries/webhook-management';

export function getWebhookControllerRetryDelayMs(attemptCount: number): number {
  return Math.min(6 * 60 * 60 * 1000, 30_000 * 2 ** Math.min(Math.max(attemptCount - 1, 0), 10));
}

export function isWebhookControllerInSync(input: {
  status: string;
  desiredGeneration: number;
  observedGeneration: number;
}): boolean {
  return input.status === 'in_sync' && input.desiredGeneration === input.observedGeneration;
}

export async function reconcileRepositoryWebhookController(repositoryId: string): Promise<void> {
  const controller = await db.query.repositoryWebhookControllers.findFirst({
    where: eq(repositoryWebhookControllers.repositoryId, repositoryId),
  });
  if (!controller) throw new Error(`Webhook controller for repository ${repositoryId} not found`);

  const repository = await db.query.repositories.findFirst({
    where: eq(repositories.id, repositoryId),
    with: {
      projects: {
        columns: { id: true, teamId: true, status: true },
      },
    },
  });
  if (!repository) throw new Error(`Repository ${repositoryId} not found`);
  const project = repository.projects.find((candidate) => candidate.status === 'active');
  if (!project) throw new Error(`Repository ${repositoryId} has no active project`);
  const secret = process.env.JUANIE_SOURCE_WEBHOOK_SECRET?.trim();
  if (!secret) throw new Error('JUANIE_SOURCE_WEBHOOK_SECRET is required');

  await db
    .update(repositoryWebhookControllers)
    .set({
      status: 'reconciling',
      attemptCount: controller.attemptCount + 1,
      updatedAt: new Date(),
    })
    .where(eq(repositoryWebhookControllers.repositoryId, repositoryId));

  try {
    const session = await getTeamIntegrationSession({
      teamId: project.teamId,
      integrationId: repository.providerId,
      requiredCapabilities: ['manage_webhook'],
    });
    const managed = await reconcileRepositorySourceWebhook({
      repository,
      session,
      canonicalUrl: controller.canonicalUrl,
      secret,
    });
    const [observed] = await db
      .update(repositoryWebhookControllers)
      .set({
        observedGeneration: controller.desiredGeneration,
        observedWebhookId: managed.id,
        observedUrl: managed.url,
        status: 'in_sync',
        attemptCount: 0,
        retryAt: null,
        lastErrorCode: null,
        lastError: null,
        lastReconciledAt: new Date(),
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(repositoryWebhookControllers.repositoryId, repositoryId),
          eq(repositoryWebhookControllers.desiredGeneration, controller.desiredGeneration)
        )
      )
      .returning({ repositoryId: repositoryWebhookControllers.repositoryId });
    if (!observed) {
      await db
        .update(repositoryWebhookControllers)
        .set({
          observedWebhookId: managed.id,
          observedUrl: managed.url,
          status: 'drifted',
          retryAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(repositoryWebhookControllers.repositoryId, repositoryId));
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const attemptCount = controller.attemptCount + 1;
    const [failed] = await db
      .update(repositoryWebhookControllers)
      .set({
        status: 'failed',
        attemptCount,
        retryAt: new Date(Date.now() + getWebhookControllerRetryDelayMs(attemptCount)),
        lastErrorCode: 'PROVIDER_RECONCILIATION_FAILED',
        lastError: message.slice(0, 10_000),
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(repositoryWebhookControllers.repositoryId, repositoryId),
          eq(repositoryWebhookControllers.desiredGeneration, controller.desiredGeneration)
        )
      )
      .returning({ repositoryId: repositoryWebhookControllers.repositoryId });
    if (!failed) {
      await db
        .update(repositoryWebhookControllers)
        .set({ status: 'drifted', retryAt: new Date(), updatedAt: new Date() })
        .where(eq(repositoryWebhookControllers.repositoryId, repositoryId));
    }
    throw error;
  }
}

export async function ensureRepositoryWebhookDesiredState(input: {
  repositoryId: string;
  canonicalUrl?: string;
}): Promise<typeof repositoryWebhookControllers.$inferSelect> {
  const canonicalUrl =
    input.canonicalUrl ?? `${getCiRuntimeDescriptor().baseUrl}/api/webhooks/source`;
  return db.transaction(async (tx) => {
    const existing = await tx.query.repositoryWebhookControllers.findFirst({
      where: eq(repositoryWebhookControllers.repositoryId, input.repositoryId),
    });
    if (!existing) {
      const [created] = await tx
        .insert(repositoryWebhookControllers)
        .values({ repositoryId: input.repositoryId, canonicalUrl, status: 'pending' })
        .returning();
      if (!created) throw new Error('Failed to create repository webhook desired state');
      return created;
    }
    if (existing.canonicalUrl === canonicalUrl) return existing;
    const [updated] = await tx
      .update(repositoryWebhookControllers)
      .set({
        canonicalUrl,
        desiredGeneration: existing.desiredGeneration + 1,
        status: 'drifted',
        retryAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(repositoryWebhookControllers.repositoryId, input.repositoryId))
      .returning();
    if (!updated) throw new Error('Failed to update repository webhook desired state');
    return updated;
  });
}
