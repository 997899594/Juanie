import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { projects, schemaRepairPlans } from '@/lib/db/schema';
import {
  gateway,
  getTeamIntegrationSession,
} from '@/lib/integrations/service/integration-control-plane';
import { inspectEnvironmentSchemaState } from '@/lib/schema-management/inspect';
import {
  isSchemaRepairResolvedStatus,
  markSchemaRepairPlanApplied,
} from '@/lib/schema-management/repair-plan';

export async function syncSchemaRepairReviewState(input: {
  projectId: string;
  planId: string;
  userId?: string | null;
}) {
  const project = await db.query.projects.findFirst({
    where: eq(projects.id, input.projectId),
    with: {
      repository: true,
    },
  });

  if (!project?.repository) {
    throw new Error('项目缺少仓库绑定');
  }

  const plan = await db.query.schemaRepairPlans.findFirst({
    where: eq(schemaRepairPlans.id, input.planId),
  });

  if (!plan || plan.projectId !== input.projectId) {
    throw new Error('修复计划不存在');
  }

  if (!plan.reviewNumber || !plan.reviewUrl) {
    throw new Error('当前修复计划还没有评审单');
  }

  const session = await getTeamIntegrationSession({
    teamId: project.teamId,
    actingUserId: input.userId ?? null,
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
  let errorMessage = plan.errorMessage ?? null;

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
      errorMessage,
      updatedAt: now,
    })
    .where(eq(schemaRepairPlans.id, plan.id))
    .returning();

  if (review.state === 'merged' && plan.status === 'review_opened') {
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
  }

  return {
    review,
    plan: updated,
  };
}
