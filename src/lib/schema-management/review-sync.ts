import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { schemaRepairPlans } from '@/lib/db/schema';
import { gateway } from '@/lib/integrations/service/integration-control-plane';
import { publishSchemaRepairRealtimeSnapshot } from '@/lib/realtime/schema-repairs';
import { inspectEnvironmentSchemaState } from '@/lib/schema-management/inspect';
import {
  loadSchemaRepairPlanExecutionContext,
  requireSchemaRepairRepositorySession,
} from '@/lib/schema-management/repair-context';
import {
  isSchemaRepairResolvedStatus,
  markSchemaRepairPlanApplied,
  type PersistedSchemaRepairPlan,
  toPersistedSchemaRepairPlan,
} from '@/lib/schema-management/repair-plan';

export function shouldAutoSyncSchemaRepairReview(
  plan: Pick<PersistedSchemaRepairPlan, 'status' | 'reviewNumber' | 'reviewUrl'>
): boolean {
  return plan.status === 'review_opened' && Boolean(plan.reviewNumber && plan.reviewUrl);
}

export async function syncLatestSchemaRepairPlans(
  plans: Map<string, PersistedSchemaRepairPlan>
): Promise<Map<string, PersistedSchemaRepairPlan>> {
  const nextPlans = new Map(plans);

  await Promise.allSettled(
    Array.from(plans.entries()).map(async ([databaseId, plan]) => {
      if (!shouldAutoSyncSchemaRepairReview(plan)) {
        return;
      }

      const result = await syncSchemaRepairReviewState({
        projectId: plan.projectId,
        planId: plan.id,
      });

      nextPlans.set(databaseId, result.plan);
    })
  );

  return nextPlans;
}

export async function syncSchemaRepairReviewState(input: {
  projectId: string;
  planId: string;
  userId?: string | null;
}) {
  const { project, plan } = await loadSchemaRepairPlanExecutionContext({
    projectId: input.projectId,
    planId: input.planId,
  });

  if (!plan.reviewNumber || !plan.reviewUrl) {
    throw new Error('当前修复计划还没有评审单');
  }

  const session = await requireSchemaRepairRepositorySession({
    teamId: project.teamId,
    userId: input.userId ?? null,
    requiredCapabilities: ['read_repo'],
  });

  const review = await gateway.getReviewRequest(
    session,
    project.repository.fullName,
    plan.reviewNumber
  );

  if (!review) {
    throw new Error('无法获取远端评审单状态');
  }

  const now = new Date();
  let statusUpdate = plan.status;
  let errorMessage: string | null = null;

  if (review.state === 'closed' && plan.status === 'review_opened') {
    statusUpdate = 'failed';
    errorMessage = '修复评审单已关闭且未合并';
  }

  const [updated] = await db
    .update(schemaRepairPlans)
    .set({
      status: statusUpdate,
      reviewState: review.state,
      reviewStateLabel: review.stateLabel,
      reviewSyncedAt: now,
      atlasExecutionStatus:
        review.state === 'merged' || review.state === 'closed'
          ? 'idle'
          : (plan.atlasExecutionStatus ?? 'idle'),
      atlasExecutionStartedAt:
        review.state === 'merged' || review.state === 'closed'
          ? null
          : plan.atlasExecutionStartedAt,
      atlasExecutionFinishedAt:
        review.state === 'merged' || review.state === 'closed'
          ? null
          : plan.atlasExecutionFinishedAt,
      atlasExecutionLog:
        review.state === 'merged' || review.state === 'closed' ? null : plan.atlasExecutionLog,
      errorMessage,
      updatedAt: now,
    })
    .where(eq(schemaRepairPlans.id, plan.id))
    .returning();

  if (review.state === 'merged' && plan.status === 'review_opened') {
    try {
      const state = await inspectEnvironmentSchemaState({
        projectId: input.projectId,
        databaseId: plan.databaseId,
      });

      if (isSchemaRepairResolvedStatus(state.status)) {
        const applied = await markSchemaRepairPlanApplied({
          projectId: input.projectId,
          planId: plan.id,
        });

        return {
          review,
          plan: applied,
        };
      }
    } catch {
      await publishSchemaRepairRealtimeSnapshot({
        projectId: input.projectId,
        databaseId: plan.databaseId,
      });

      return {
        review,
        plan: toPersistedSchemaRepairPlan(updated),
      };
    }
  }

  await publishSchemaRepairRealtimeSnapshot({
    projectId: input.projectId,
    databaseId: plan.databaseId,
  });

  return {
    review,
    plan: toPersistedSchemaRepairPlan(updated),
  };
}
