import { NextRequest } from 'next/server';
import { getProjectAccessOrThrow, requireSession } from '@/lib/api/access';
import { isAccessError } from '@/lib/api/errors';
import { logger } from '@/lib/logger';
import { getProjectInitOverviewSnapshot } from '@/lib/projects/init-service';
import { createProjectInitRealtimeSubscriber } from '@/lib/realtime/project-init';
import { createSafeSSEWriter, sseResponseHeaders } from '@/lib/realtime/sse';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const routeLogger = logger.child({ route: 'api/projects/init-stream' });

function shouldKeepProjectInitStreamOpen(
  overview: Awaited<ReturnType<typeof getProjectInitOverviewSnapshot>>
) {
  if (overview.status === 'initializing') {
    return true;
  }

  return overview.status === 'failed' && overview.recoveryAction?.kind === 'wait';
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireSession();
    const { id } = await params;
    await getProjectAccessOrThrow(id, session.user.id);

    const stream = new ReadableStream({
      async start(controller) {
        const sse = createSafeSSEWriter(controller);
        let unsubscribe: (() => Promise<void>) | null = null;
        let pollingTimer: ReturnType<typeof setInterval> | null = null;
        let heartbeatTimer: ReturnType<typeof setInterval> | null = null;
        let emitLock = Promise.resolve();

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
            routeLogger.error('Project init stream task failed', error, {
              projectId: id,
            });
          });
        };

        const emitLatestOverview = async () => {
          const overview = await getProjectInitOverviewSnapshot(id);

          sendEvent({
            type: 'progress',
            overview,
          });

          if (overview.status === 'active') {
            sendEvent({
              type: 'complete',
              message: '项目初始化完成',
              overview,
            });
            return false;
          }

          if (overview.status === 'failed' && overview.recoveryAction?.kind !== 'wait') {
            sendEvent({
              type: 'error',
              message: overview.primarySummary,
              overview,
            });
            return false;
          }

          return shouldKeepProjectInitStreamOpen(overview);
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
              const keepOpen = await emitLatestOverview();
              if (!keepOpen) {
                await cleanup();
              }
            });
          }, 1000);
        };

        const start = async () => {
          try {
            const keepOpen = await emitLatestOverview();
            if (!keepOpen) {
              await cleanup();
              return;
            }

            heartbeatTimer = setInterval(() => {
              sendEvent({ type: 'ping', timestamp: Date.now() });
            }, 15000);

            try {
              unsubscribe = await createProjectInitRealtimeSubscriber({
                projectId: id,
                onEvent: async () => {
                  runSerialized(async () => {
                    const nextKeepOpen = await emitLatestOverview();
                    if (!nextKeepOpen) {
                      await cleanup();
                    }
                  });
                },
              });

              if (!unsubscribe) {
                startPollingFallback();
              }
            } catch (error) {
              routeLogger.error('Failed to subscribe to project init realtime events', error, {
                projectId: id,
              });
              startPollingFallback();
            }
          } catch (error) {
            routeLogger.error('Project init realtime stream failed', error, {
              projectId: id,
            });
            sendEvent({
              type: 'error',
              message: '读取初始化进度失败',
            });
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
