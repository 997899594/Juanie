import { and, eq } from 'drizzle-orm';
import { NextRequest } from 'next/server';
import { getProjectAccessOrThrow, requireSession } from '@/lib/api/access';
import { isAccessError } from '@/lib/api/errors';
import { db } from '@/lib/db';
import { deployments } from '@/lib/db/schema';
import { logger } from '@/lib/logger';
import {
  createDeploymentLogRealtimeSubscriber,
  loadDeploymentRealtimeSummary,
  loadScopedDeploymentRealtimeLogs,
} from '@/lib/realtime/deployments';
import { createSafeSSEWriter, sseResponseHeaders } from '@/lib/realtime/sse';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const routeLogger = logger.child({ route: 'api/projects/deployment-log-stream' });

function isTerminalDeploymentStatus(status: string | null | undefined): boolean {
  return (
    status === 'running' ||
    status === 'awaiting_rollout' ||
    status === 'verification_failed' ||
    status === 'failed' ||
    status === 'migration_failed' ||
    status === 'rolled_back' ||
    status === 'canceled'
  );
}

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
        const sse = createSafeSSEWriter(controller);
        let unsubscribe: (() => Promise<void>) | null = null;
        let pollingTimer: ReturnType<typeof setInterval> | null = null;
        let heartbeatTimer: ReturnType<typeof setInterval> | null = null;
        let emitLock = Promise.resolve();
        let sentCount = 0;

        const sendEvent = (data: object) => {
          sse.send(data);
        };

        const close = () => {
          if (pollingTimer) {
            clearInterval(pollingTimer);
            pollingTimer = null;
          }
          if (heartbeatTimer) {
            clearInterval(heartbeatTimer);
            heartbeatTimer = null;
          }
          sse.close();
        };

        const runSerialized = (task: () => Promise<void>) => {
          emitLock = emitLock.then(task).catch((error) => {
            routeLogger.error('Deployment log stream task failed', error, {
              projectId: id,
              deploymentId: depId,
            });
          });
        };

        const cleanup = async () => {
          request.signal.removeEventListener('abort', onAbort);
          if (unsubscribe) {
            await unsubscribe();
            unsubscribe = null;
          }
          close();
        };

        const onAbort = () => {
          void cleanup();
        };
        request.signal.addEventListener('abort', onAbort);

        const emitSnapshot = async () => {
          const logs = await loadScopedDeploymentRealtimeLogs({
            projectId: id,
            deploymentId: depId,
          });
          sentCount = logs.length;
          sendEvent({ type: 'logs', mode: 'replace', logs });

          const summary = await loadDeploymentRealtimeSummary(depId);
          if (isTerminalDeploymentStatus(summary?.status)) {
            sendEvent({ type: 'complete', status: summary?.status });
            return false;
          }

          return true;
        };

        const startPollingFallback = () => {
          pollingTimer = setInterval(() => {
            runSerialized(async () => {
              const logs = await loadScopedDeploymentRealtimeLogs({
                projectId: id,
                deploymentId: depId,
              });

              if (logs.length > sentCount) {
                const nextLogs = logs.slice(sentCount);
                sentCount = logs.length;
                sendEvent({ type: 'logs', mode: 'append', logs: nextLogs });
              }

              const summary = await loadDeploymentRealtimeSummary(depId);
              if (isTerminalDeploymentStatus(summary?.status)) {
                sendEvent({ type: 'complete', status: summary?.status });
                await cleanup();
              }
            });
          }, 1000);
        };

        const start = async () => {
          try {
            sendEvent({ type: 'connected', timestamp: Date.now() });

            const keepOpen = await emitSnapshot();
            if (!keepOpen) {
              await cleanup();
              return;
            }

            heartbeatTimer = setInterval(() => {
              sendEvent({ type: 'ping', timestamp: Date.now() });
            }, 15000);

            try {
              unsubscribe = await createDeploymentLogRealtimeSubscriber({
                deploymentId: depId,
                onEvent: async (event) => {
                  runSerialized(async () => {
                    if (event.kind === 'deployment_log_appended') {
                      sentCount += 1;
                      sendEvent({
                        type: 'logs',
                        mode: 'append',
                        logs: [event.log],
                      });
                      return;
                    }

                    if (isTerminalDeploymentStatus(event.status)) {
                      sendEvent({ type: 'complete', status: event.status });
                      await cleanup();
                    }
                  });
                },
              });

              if (!unsubscribe) {
                startPollingFallback();
              }
            } catch (error) {
              routeLogger.error('Failed to subscribe to deployment log realtime events', error, {
                projectId: id,
                deploymentId: depId,
              });
              startPollingFallback();
            }
          } catch (err) {
            routeLogger.error('Deployment log stream failed', err, {
              projectId: id,
              deploymentId: depId,
            });
            sendEvent({ type: 'error', message: 'Failed to fetch logs' });
            await cleanup();
          }
        };

        void start();
      },
    });

    return new Response(stream, {
      headers: sseResponseHeaders,
    });
  } catch (error) {
    if (isAccessError(error)) {
      return new Response(error.message, { status: error.status });
    }

    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(errorMessage, { status: 500 });
  }
}
