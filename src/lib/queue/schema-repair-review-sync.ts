import { Cron } from 'croner';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { schemaRepairPlans } from '@/lib/db/schema';
import { logger } from '@/lib/logger';
import { syncSchemaRepairReviewState } from '@/lib/schema-management/review-sync';

const DEFAULT_SCHEMA_REPAIR_REVIEW_SYNC_SCHEDULE = '*/15 * * * *';
const schemaRepairReviewSyncLogger = logger.child({ component: 'schema-repair-review-sync' });

export function startSchemaRepairReviewSync(): void {
  new Cron(DEFAULT_SCHEMA_REPAIR_REVIEW_SYNC_SCHEDULE, async () => {
    try {
      const plans = await db.query.schemaRepairPlans.findMany({
        where: eq(schemaRepairPlans.status, 'review_opened'),
        orderBy: (table, { desc }) => [desc(table.updatedAt)],
        limit: 50,
      });

      for (const plan of plans) {
        try {
          await syncSchemaRepairReviewState({
            projectId: plan.projectId,
            planId: plan.id,
          });
        } catch (error) {
          schemaRepairReviewSyncLogger.warn('Failed to sync schema repair review state', {
            planId: plan.id,
            projectId: plan.projectId,
            errorMessage: error instanceof Error ? error.message : String(error),
          });
        }
      }
    } catch (error) {
      schemaRepairReviewSyncLogger.error('Schema repair review sync failed', error);
    }
  });

  schemaRepairReviewSyncLogger.info('Schema repair review sync started', {
    schedule: DEFAULT_SCHEMA_REPAIR_REVIEW_SYNC_SCHEDULE,
  });
}
