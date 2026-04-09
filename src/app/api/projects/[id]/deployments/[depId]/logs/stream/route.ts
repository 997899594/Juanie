import { and, asc, eq } from 'drizzle-orm';
import { NextRequest } from 'next/server';
import { getProjectAccessOrThrow, requireSession } from '@/lib/api/access';
import { isAccessError } from '@/lib/api/errors';
import { db } from '@/lib/db';
import { deploymentLogs, deployments } from '@/lib/db/schema';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; depId: string }> }
) {
  try {
    const session = await requireSession();
    const { id, depId } = await params;
    await getProjectAccessOrThrow(id, session.user.id);

    const deployment = await db.query.deployments.findFirst({
      where: and(eq(deployments.id, depId), eq(deployments.projectId, id)),
    });

    if (!deployment) {
      return new Response('Deployment not found', { status: 404 });
    }

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

        let sentCount = 0;
        let done = false;
        const onAbort = () => {
          done = true;
          close();
        };
        request.signal.addEventListener('abort', onAbort);

        const poll = async () => {
          try {
            while (!done) {
              try {
                const allLogs = await db.query.deploymentLogs.findMany({
                  where: eq(deploymentLogs.deploymentId, depId),
                  orderBy: [asc(deploymentLogs.createdAt)],
                });

                if (allLogs.length > sentCount) {
                  const newLogs = allLogs.slice(sentCount);
                  sentCount = allLogs.length;
                  sendEvent({ type: 'logs', logs: newLogs });
                }

                const current = await db.query.deployments.findFirst({
                  where: eq(deployments.id, depId),
                });

                if (
                  current?.status === 'running' ||
                  current?.status === 'awaiting_rollout' ||
                  current?.status === 'verification_failed' ||
                  current?.status === 'failed' ||
                  current?.status === 'migration_failed' ||
                  current?.status === 'rolled_back'
                ) {
                  sendEvent({ type: 'complete', status: current.status });
                  done = true;
                  return;
                }

                await new Promise((r) => setTimeout(r, 1000));
              } catch (err) {
                console.error('Log stream poll error:', err);
                sendEvent({ type: 'error', message: 'Failed to fetch logs' });
                done = true;
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
