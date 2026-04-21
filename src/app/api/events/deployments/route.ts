import { NextRequest } from 'next/server';
import { getProjectAccessOrThrow, requireSession } from '@/lib/api/access';
import { isAccessError } from '@/lib/api/errors';
import { logger } from '@/lib/logger';
import {
  createDeploymentRealtimeSubscriber,
  type DeploymentRealtimeSummary,
  loadLatestProjectDeploymentRealtimeSummary,
} from '@/lib/realtime/deployments';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const routeLogger = logger.child({ route: 'api/events/deployments' });

function buildDeploymentStateKey(deployment: DeploymentRealtimeSummary | null): string | null {
  if (!deployment) {
    return null;
  }

  return [
    deployment.id,
    deployment.status,
    deployment.commitSha ?? '',
    deployment.deployedAt ?? '',
    deployment.createdAt,
  ].join(':');
}

export async function GET(request: NextRequest) {
  try {
    const session = await requireSession();
    const url = new URL(request.url);
    const projectId = url.searchParams.get('projectId');

    if (!projectId) {
      return new Response('Project ID required', { status: 400 });
    }

    await getProjectAccessOrThrow(projectId, session.user.id);

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        let closed = false;
        let unsubscribe: (() => Promise<void>) | null = null;
        let pollingTimer: ReturnType<typeof setInterval> | null = null;
        let heartbeatTimer: ReturnType<typeof setInterval> | null = null;
        let emitLock = Promise.resolve();
        let lastStateKey: string | null = null;

        const sendEvent = (data: object) => {
          if (closed) {
            return;
          }

          controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
        };

        sendEvent({ type: 'connected', timestamp: Date.now() });

        const close = () => {
          if (closed) {
            return;
          }

          closed = true;

          if (pollingTimer) {
            clearInterval(pollingTimer);
            pollingTimer = null;
          }

          if (heartbeatTimer) {
            clearInterval(heartbeatTimer);
            heartbeatTimer = null;
          }

          controller.close();
        };

        const runSerialized = (task: () => Promise<void>) => {
          emitLock = emitLock.then(task).catch((error) => {
            routeLogger.error('Deployment stream task failed', error, {
              projectId,
            });
          });
        };

        const emitDeployment = async (deployment: DeploymentRealtimeSummary | null) => {
          const nextStateKey = buildDeploymentStateKey(deployment);
          if (!nextStateKey || nextStateKey === lastStateKey) {
            return;
          }

          lastStateKey = nextStateKey;
          sendEvent({
            type: 'deployment',
            data: deployment,
          });
        };

        const emitCurrentDeployment = async () => {
          await emitDeployment(await loadLatestProjectDeploymentRealtimeSummary(projectId));
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

        const startPollingFallback = () => {
          pollingTimer = setInterval(() => {
            runSerialized(async () => {
              await emitCurrentDeployment();
            });
          }, 3000);
        };

        const start = async () => {
          try {
            await emitCurrentDeployment();

            heartbeatTimer = setInterval(() => {
              sendEvent({ type: 'ping', timestamp: Date.now() });
            }, 15000);

            try {
              unsubscribe = await createDeploymentRealtimeSubscriber({
                projectId,
                onEvent: async (event) => {
                  runSerialized(async () => {
                    await emitDeployment(event.deployment);
                  });
                },
              });

              if (!unsubscribe) {
                startPollingFallback();
              }
            } catch (error) {
              routeLogger.error('Failed to subscribe to deployment realtime events', error, {
                projectId,
              });
              startPollingFallback();
            }
          } catch (error) {
            routeLogger.error('Deployment realtime stream failed', error, {
              projectId,
            });
            sendEvent({
              type: 'error',
              message: '读取部署进度失败',
            });
            await cleanup();
          }
        };

        void start();
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
