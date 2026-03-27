import { and, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { environments, projects, teamMembers } from '@/lib/db/schema';
import { canManageEnvironment, getEnvironmentGuardReason } from '@/lib/policies/delivery';

const updateEnvironmentSchema = z.object({
  deploymentStrategy: z.enum(['rolling', 'controlled', 'canary', 'blue_green']),
});

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; envId: string }> }
) {
  const { id, envId } = await params;
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: '未登录' }, { status: 401 });
  }

  const project = await db.query.projects.findFirst({
    where: eq(projects.id, id),
  });

  if (!project) {
    return NextResponse.json({ error: '项目不存在' }, { status: 404 });
  }

  const member = await db.query.teamMembers.findFirst({
    where: and(eq(teamMembers.teamId, project.teamId), eq(teamMembers.userId, session.user.id)),
  });

  if (!member) {
    return NextResponse.json({ error: '没有权限' }, { status: 403 });
  }

  const environment = await db.query.environments.findFirst({
    where: and(eq(environments.id, envId), eq(environments.projectId, id)),
  });

  if (!environment) {
    return NextResponse.json({ error: '环境不存在' }, { status: 404 });
  }

  if (!canManageEnvironment(member.role, environment)) {
    return NextResponse.json({ error: getEnvironmentGuardReason(environment) }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const parsed = updateEnvironmentSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: '发布策略无效' }, { status: 400 });
  }

  const [updated] = await db
    .update(environments)
    .set({
      deploymentStrategy: parsed.data.deploymentStrategy,
      updatedAt: new Date(),
    })
    .where(eq(environments.id, envId))
    .returning();

  return NextResponse.json({
    success: true,
    environment: {
      id: updated.id,
      deploymentStrategy: updated.deploymentStrategy,
    },
  });
}
