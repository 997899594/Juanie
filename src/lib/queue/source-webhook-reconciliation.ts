import { Cron } from 'croner';
import { eq } from 'drizzle-orm';
import { getCiRuntimeDescriptor } from '@/lib/ci/runtime-assets';
import { db } from '@/lib/db';
import { projects } from '@/lib/db/schema';
import {
  gateway,
  getTeamIntegrationSession,
} from '@/lib/integrations/service/integration-control-plane';
import { logger } from '@/lib/logger';

const schedule = process.env.SOURCE_WEBHOOK_RECONCILIATION_SCHEDULE?.trim() || '17 */6 * * *';
const batchSize = 100;
const reconciliationLogger = logger.child({ component: 'source-webhook-reconciliation' });
let running = false;
let tickRunning = false;
let nextOffset = 0;

export async function reconcileSourceWebhooks(): Promise<{
  checked: number;
  reconciled: number;
  failed: number;
}> {
  const secret = process.env.JUANIE_SOURCE_WEBHOOK_SECRET?.trim();
  if (!secret) throw new Error('JUANIE_SOURCE_WEBHOOK_SECRET is required');
  const webhookUrl = `${getCiRuntimeDescriptor().baseUrl}/api/webhooks/source`;
  const projectList = await db.query.projects.findMany({
    where: eq(projects.status, 'active'),
    orderBy: (project, { asc }) => [asc(project.createdAt), asc(project.id)],
    limit: batchSize,
    offset: nextOffset,
    with: { repository: true },
  });
  nextOffset = projectList.length === batchSize ? nextOffset + batchSize : 0;
  let reconciled = 0;
  let failed = 0;

  for (const project of projectList) {
    if (!project.repository) continue;
    try {
      const session = await getTeamIntegrationSession({
        teamId: project.teamId,
        integrationId: project.repository.providerId,
        requiredCapabilities: ['manage_webhook'],
      });
      await gateway.ensurePushWebhook(session, {
        repoFullName: project.repository.fullName,
        url: webhookUrl,
        secret,
      });
      reconciled += 1;
    } catch (error) {
      failed += 1;
      reconciliationLogger.warn('Source webhook reconciliation skipped project', {
        projectId: project.id,
        repository: project.repository.fullName,
        errorMessage: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return { checked: projectList.length, reconciled, failed };
}

export function startSourceWebhookReconciliation(): void {
  if (running) return;
  running = true;
  const tick = async () => {
    if (tickRunning) {
      reconciliationLogger.info('Source webhook reconciliation already running');
      return;
    }
    tickRunning = true;
    try {
      reconciliationLogger.info(
        'Source webhook reconciliation completed',
        await reconcileSourceWebhooks()
      );
    } catch (error) {
      reconciliationLogger.error('Source webhook reconciliation failed', error);
    } finally {
      tickRunning = false;
    }
  };
  void tick();
  new Cron(schedule, tick);
  reconciliationLogger.info('Source webhook reconciliation started', { schedule, batchSize });
}
