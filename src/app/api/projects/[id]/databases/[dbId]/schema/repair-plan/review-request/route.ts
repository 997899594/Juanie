import { and, desc, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { getProjectAccessOrThrow, requireSession } from '@/lib/api/access';
import { isAccessError, toAccessErrorResponse } from '@/lib/api/errors';
import { db } from '@/lib/db';
import { databases, schemaRepairPlans } from '@/lib/db/schema';
import { canManageEnvironment, getEnvironmentGuardReason } from '@/lib/policies/delivery';
import { runSchemaRepairAtlas } from '@/lib/schema-management/atlas-run';
import { createSchemaRepairReviewRequest } from '@/lib/schema-management/review-request';

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string; dbId: string }> }
) {
  try {
    const { id: projectId, dbId } = await params;
    const session = await requireSession();
    const { member } = await getProjectAccessOrThrow(projectId, session.user.id);

    const database = await db.query.databases.findFirst({
      where: and(eq(databases.id, dbId), eq(databases.projectId, projectId)),
      with: {
        environment: true,
      },
    });

    if (!database) {
      return NextResponse.json({ error: '数据库不存在' }, { status: 404 });
    }

    if (!database.environment) {
      return NextResponse.json({ error: '数据库缺少环境绑定' }, { status: 400 });
    }

    if (!canManageEnvironment(member.role, database.environment)) {
      return NextResponse.json(
        { error: getEnvironmentGuardReason(database.environment) },
        { status: 403 }
      );
    }

    const latestPlan = await db.query.schemaRepairPlans.findFirst({
      where: and(
        eq(schemaRepairPlans.projectId, projectId),
        eq(schemaRepairPlans.databaseId, dbId)
      ),
      orderBy: [desc(schemaRepairPlans.createdAt)],
    });

    if (!latestPlan) {
      return NextResponse.json({ error: '请先生成修复计划' }, { status: 400 });
    }

    const result = await createSchemaRepairReviewRequest({
      projectId,
      planId: latestPlan.id,
      userId: session.user.id,
    });

    const shouldAutoRunAtlas = ['repair_pr_required', 'adopt_current_db'].includes(
      result.plan.kind
    );

    if (!shouldAutoRunAtlas) {
      return NextResponse.json(
        {
          ...result,
          autoRun: {
            status: 'skipped',
            message: '当前修复计划不需要自动生成 migration',
            run: null,
          },
        },
        { status: 200 }
      );
    }

    try {
      const run = await runSchemaRepairAtlas({
        projectId,
        planId: result.plan.id,
        userId: session.user.id,
      });

      return NextResponse.json(
        {
          ...result,
          autoRun: {
            status: run.status,
            message: '修复 PR 已创建，Atlas 已自动加入队列',
            run,
          },
        },
        { status: 200 }
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : '自动运行 Atlas 失败';
      const [updatedPlan] = await db
        .update(schemaRepairPlans)
        .set({
          atlasExecutionStatus: 'failed',
          errorMessage: `自动运行 Atlas 失败: ${message}`,
          updatedAt: new Date(),
        })
        .where(eq(schemaRepairPlans.id, result.plan.id))
        .returning();

      return NextResponse.json(
        {
          review: result.review,
          plan: updatedPlan ?? result.plan,
          autoRun: {
            status: 'failed',
            message,
            run: null,
          },
        },
        { status: 200 }
      );
    }
  } catch (error) {
    if (isAccessError(error)) {
      return toAccessErrorResponse(error);
    }

    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
