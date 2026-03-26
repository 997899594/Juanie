import { and, eq, inArray } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { projectInitSteps, projects, teamMembers } from '@/lib/db/schema';
import { getProjectInitPageData, getProjectInitRetryContext } from '@/lib/projects/init-service';
import { addProjectInitJob } from '@/lib/queue';

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: '未登录' }, { status: 401 });
  }

  const { id } = await params;
  const retryContext = await getProjectInitRetryContext(id, session.user.id);

  if (!retryContext) {
    return NextResponse.json({ error: '当前初始化状态不可重试' }, { status: 400 });
  }

  if (!retryContext.retryAllowed) {
    return NextResponse.json(
      { error: retryContext.retryBlockedReason ?? '当前错误不支持直接重试', code: 'retry_blocked' },
      { status: 400 }
    );
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
    return NextResponse.json({ error: '无权限访问该项目' }, { status: 403 });
  }

  const steps = await db.query.projectInitSteps.findMany({
    where: eq(projectInitSteps.projectId, id),
    orderBy: (step, { asc }) => [asc(step.createdAt)],
  });

  const stepsToReset = steps.slice(retryContext.failedStepOrder).map((step) => step.id);

  if (stepsToReset.length === 0) {
    return NextResponse.json({ error: '当前初始化状态不可重试' }, { status: 400 });
  }

  await Promise.all([
    db
      .update(projectInitSteps)
      .set({
        status: 'pending',
        message: null,
        progress: 0,
        errorCode: null,
        error: null,
        startedAt: null,
        completedAt: null,
      })
      .where(inArray(projectInitSteps.id, stepsToReset)),
    db
      .update(projects)
      .set({
        status: 'initializing',
        updatedAt: new Date(),
      })
      .where(eq(projects.id, id)),
  ]);

  await addProjectInitJob(id, retryContext.mode, retryContext.template);

  const pageData = await getProjectInitPageData(id, session.user.id);
  if (!pageData) {
    return NextResponse.json({ error: '项目不存在或无权限访问' }, { status: 404 });
  }

  return NextResponse.json({
    overview: pageData.overview,
  });
}
