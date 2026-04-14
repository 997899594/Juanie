import { and, desc, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { getProjectAccessOrThrow, requireSession } from '@/lib/api/access';
import { isAccessError, toAccessErrorResponse } from '@/lib/api/errors';
import { db } from '@/lib/db';
import { databases, schemaRepairPlans } from '@/lib/db/schema';
import { canManageEnvironment, getEnvironmentGuardReason } from '@/lib/policies/delivery';
import { discardSchemaRepairPlan } from '@/lib/schema-management/repair-plan';

export async function POST(_request: Request, context: { params: Promise<unknown> }) {
  try {
    const { id: projectId, dbId } = (await context.params) as { id: string; dbId: string };
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
      return NextResponse.json({ error: '没有可丢弃的修复建议' }, { status: 400 });
    }

    const plan = await discardSchemaRepairPlan({
      projectId,
      planId: latestPlan.id,
    });

    return NextResponse.json({ plan }, { status: 200 });
  } catch (error) {
    if (isAccessError(error)) {
      return toAccessErrorResponse(error);
    }

    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
