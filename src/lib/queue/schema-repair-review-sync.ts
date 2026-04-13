import { Cron } from 'croner';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { schemaRepairPlans } from '@/lib/db/schema';
import { syncSchemaRepairReviewState } from '@/lib/schema-management/review-sync';

const DEFAULT_SCHEMA_REPAIR_REVIEW_SYNC_SCHEDULE = '*/15 * * * *';

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
          console.warn(`[SchemaRepairReviewSync] Failed for plan ${plan.id}:`, error);
        }
      }
    } catch (error) {
      console.error('[SchemaRepairReviewSync] Error:', error);
    }
  });

  console.log(
    `[SchemaRepairReviewSync] Started (schedule: ${DEFAULT_SCHEMA_REPAIR_REVIEW_SYNC_SCHEDULE})`
  );
}
