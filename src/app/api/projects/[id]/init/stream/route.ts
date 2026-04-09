import { eq } from 'drizzle-orm';
import { NextRequest } from 'next/server';
import { getProjectAccessOrThrow, requireSession } from '@/lib/api/access';
import { isAccessError } from '@/lib/api/errors';
import { db } from '@/lib/db';
import { projectInitSteps, projects } from '@/lib/db/schema';
import { buildProjectInitOverview } from '@/lib/projects/init-view';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireSession();
    const { id } = await params;
    await getProjectAccessOrThrow(id, session.user.id);

    const stream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder();
        let closed = false;

        const sendEvent = (data: object) => {
          if (closed) return;
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
        };

        const close = () => {
          if (closed) return;
          closed = true;
          controller.close();
        };

        let isComplete = false;
        let hasError = false;
        const onAbort = () => {
          isComplete = true;
          hasError = true;
          close();
        };
        request.signal.addEventListener('abort', onAbort);

        const poll = async () => {
          try {
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
              }
            }
          } finally {
            request.signal.removeEventListener('abort', onAbort);
            close();
          }
        };

        void poll();
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
    });
  } catch (error) {
    if (isAccessError(error)) {
      return new Response(error.message, { status: error.status });
    }

    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(errorMessage, { status: 500 });
  }
}
