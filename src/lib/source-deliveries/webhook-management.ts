import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { repositories } from '@/lib/db/schema';
import {
  gateway,
  type IntegrationSession,
} from '@/lib/integrations/service/integration-control-plane';

export function getLegacySourceWebhookUrls(canonicalUrl: string): string[] {
  const origin = new URL(canonicalUrl).origin;
  return [
    `${origin}/api/webhooks/git`,
    'https://undefined/api/webhooks/git',
    'http://undefined/api/webhooks/git',
  ];
}

export async function reconcileRepositorySourceWebhook(input: {
  repository: typeof repositories.$inferSelect;
  session: IntegrationSession;
  canonicalUrl: string;
  secret: string;
}): Promise<void> {
  try {
    const managed = await gateway.ensurePushWebhook(input.session, {
      repoFullName: input.repository.fullName,
      url: input.canonicalUrl,
      secret: input.secret,
      managedWebhookId: input.repository.sourceWebhookId,
      legacyUrls: getLegacySourceWebhookUrls(input.canonicalUrl),
    });
    await db
      .update(repositories)
      .set({
        sourceWebhookId: managed.id,
        sourceWebhookUrl: managed.url,
        sourceWebhookStatus: 'verified',
        sourceWebhookVerifiedAt: new Date(),
        sourceWebhookLastError: null,
      })
      .where(eq(repositories.id, input.repository.id));
  } catch (error) {
    await db
      .update(repositories)
      .set({
        sourceWebhookStatus: 'failed',
        sourceWebhookLastError: (error instanceof Error ? error.message : String(error)).slice(
          0,
          10_000
        ),
      })
      .where(eq(repositories.id, input.repository.id));
    throw error;
  }
}
