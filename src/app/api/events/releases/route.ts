import { NextRequest } from 'next/server';
import { getProjectAccessOrThrow, requireSession } from '@/lib/api/access';
import { isAccessError } from '@/lib/api/errors';
import { logger } from '@/lib/logger';
import {
  createReleaseRealtimeSubscriber,
  loadLatestProjectReleaseRealtimeRecord,
  loadReleaseRealtimeRecord,
  type ReleaseRealtimeRecord,
} from '@/lib/realtime/releases';
import { buildReleaseEventStateKey } from '@/lib/releases/event-state';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const routeLogger = logger.child({ route: 'api/events/releases' });

export async function GET(request: NextRequest) {
  try {
    const session = await requireSession();
    const url = new URL(request.url);
    const projectId = url.searchParams.get('projectId');
    const releaseId = url.searchParams.get('releaseId');

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
            routeLogger.error('Release stream task failed', error, {
              projectId,
              releaseId,
            });
          });
        };

        const emitRelease = async (release: ReleaseRealtimeRecord | null) => {
          if (!release) {
            return;
          }

          if (releaseId && release.id !== releaseId) {
            return;
          }

          const nextStateKey = buildReleaseEventStateKey(release);
          if (!nextStateKey || nextStateKey === lastStateKey) {
            return;
          }

          lastStateKey = nextStateKey;
          sendEvent({
            type: 'release',
            data: release,
          });
        };

        const loadCurrentRelease = async () => {
          if (releaseId) {
            const payload = await loadReleaseRealtimeRecord(releaseId);
            if (!payload || payload.projectId !== projectId) {
              return null;
            }

            return payload.release;
          }

          const payload = await loadLatestProjectReleaseRealtimeRecord(projectId);
          return payload?.release ?? null;
        };

        const emitCurrentRelease = async () => {
          await emitRelease(await loadCurrentRelease());
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
              await emitCurrentRelease();
            });
          }, 3000);
        };

        const start = async () => {
          try {
            await emitCurrentRelease();

            heartbeatTimer = setInterval(() => {
              sendEvent({ type: 'ping', timestamp: Date.now() });
            }, 15000);

            try {
              unsubscribe = await createReleaseRealtimeSubscriber({
                projectId,
                onEvent: async (event) => {
                  runSerialized(async () => {
                    await emitRelease(event.release);
                  });
                },
              });

              if (!unsubscribe) {
                startPollingFallback();
              }
            } catch (error) {
              routeLogger.error('Failed to subscribe to release realtime events', error, {
                projectId,
                releaseId,
              });
              startPollingFallback();
            }
          } catch (error) {
            routeLogger.error('Release realtime stream failed', error, {
              projectId,
              releaseId,
            });
            sendEvent({
              type: 'error',
              message: '读取发布进度失败',
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
