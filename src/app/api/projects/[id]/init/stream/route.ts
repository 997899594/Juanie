import { and, eq } from 'drizzle-orm';
import { NextRequest } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { projectInitSteps, projects, teamMembers } from '@/lib/db/schema';
import { buildProjectInitOverview } from '@/lib/projects/init-view';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();

  if (!session?.user?.id) {
    return new Response('未登录', { status: 401 });
  }

  const { id } = await params;

  const project = await db.query.projects.findFirst({
    where: eq(projects.id, id),
  });

  if (!project) {
    return new Response('项目不存在', { status: 404 });
  }

  const member = await db.query.teamMembers.findFirst({
    where: and(eq(teamMembers.teamId, project.teamId), eq(teamMembers.userId, session.user.id)),
  });

  if (!member) {
    return new Response('无权限访问该项目', { status: 403 });
  }

  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();

      const sendEvent = (data: object) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      };

      let isComplete = false;
      let hasError = false;

      const poll = async () => {
        while (!isComplete && !hasError) {
          try {
            const steps = await db.query.projectInitSteps.findMany({
              where: eq(projectInitSteps.projectId, id),
              orderBy: (steps, { asc }) => [asc(steps.createdAt)],
            });
            const overview = buildProjectInitOverview(
              steps.map((step) => ({
                id: step.id,
                step: step.step,
                status: step.status,
                message: step.message,
                progress: step.progress,
                errorCode: step.errorCode,
                error: step.error,
              }))
            );

            if (overview.steps.length === 0) {
              sendEvent({
                type: 'progress',
                overview,
              });
              await new Promise((r) => setTimeout(r, 1000));
              continue;
            }

            sendEvent({
              type: 'progress',
              overview,
            });

            if (overview.status === 'failed' && overview.recoveryAction?.kind !== 'wait') {
              sendEvent({
                type: 'error',
                message: overview.primarySummary,
                overview,
              });
              hasError = true;
              controller.close();
              return;
            }

            if (overview.status === 'failed' && overview.recoveryAction?.kind === 'wait') {
              await new Promise((r) => setTimeout(r, 1000));
              continue;
            }

            if (overview.status === 'active') {
              await db
                .update(projects)
                .set({ status: 'active', updatedAt: new Date() })
                .where(eq(projects.id, id));

              sendEvent({
                type: 'complete',
                message: '项目初始化完成',
                overview,
              });
              isComplete = true;
              controller.close();
              return;
            }

            await new Promise((r) => setTimeout(r, 1000));
          } catch (err) {
            console.error('Poll error:', err);
            sendEvent({
              type: 'error',
              message: '读取初始化进度失败',
            });
            hasError = true;
            controller.close();
          }
        }
      };

      poll();
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  });
}
