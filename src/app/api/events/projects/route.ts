import { NextRequest } from 'next/server';
import { getProjectAccessOrThrow, requireSession } from '@/lib/api/access';
import { isAccessError } from '@/lib/api/errors';
import { logger } from '@/lib/logger';
import {
  createProjectRealtimeSubscriber,
  loadProjectRealtimeRecord,
  type ProjectRealtimeEvent,
} from '@/lib/realtime/projects';
import { createSafeSSEWriter, sseResponseHeaders } from '@/lib/realtime/sse';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const routeLogger = logger.child({ route: 'api/events/projects' });

function parseProjectIds(request: NextRequest): string[] {
  const url = new URL(request.url);
  const rawIds = url.searchParams.get('projectIds') ?? '';

  return [
    ...new Set(
      rawIds
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean)
    ),
  ];
}

function buildStateKey(event: ProjectRealtimeEvent): string {
  if (event.kind === 'project_deleted') {
    return `${event.kind}:${event.projectId}`;
  }

  return `${event.kind}:${event.projectId}:${event.project.status ?? 'unknown'}:${event.project.updatedAt}`;
}

export async function GET(request: NextRequest) {
  try {
    const session = await requireSession();
    const projectIds = parseProjectIds(request);

    if (projectIds.length === 0) {
      return new Response('Project IDs required', { status: 400 });
    }

    await Promise.all(
      projectIds.map(async (projectId) => {
        try {
          await getProjectAccessOrThrow(projectId, session.user.id);
        } catch (error) {
          if (isAccessError(error) && error.status === 404) {
            return;
          }

          throw error;
        }
      })
    );

    const stream = new ReadableStream({
      async start(controller) {
        const sse = createSafeSSEWriter(controller);
        let unsubscribe: (() => Promise<void>) | null = null;
        let pollingTimer: ReturnType<typeof setInterval> | null = null;
        let heartbeatTimer: ReturnType<typeof setInterval> | null = null;
        let emitLock = Promise.resolve();
        const lastStateByProjectId = new Map<string, string>();

        const sendEvent = (data: object) => {
          sse.send(data);
        };

        sendEvent({ type: 'connected', timestamp: Date.now() });

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
            routeLogger.error('Project stream task failed', error, {
              projectIds,
            });
          });
        };

        const emitProjectEvent = (event: ProjectRealtimeEvent) => {
          const stateKey = buildStateKey(event);
          if (lastStateByProjectId.get(event.projectId) === stateKey) {
            return;
          }

          lastStateByProjectId.set(event.projectId, stateKey);
          sendEvent({
            type: 'project',
            data: event,
          });
        };

        const emitCurrentProjects = async () => {
          const records = await Promise.all(
            projectIds.map((projectId) => loadProjectRealtimeRecord(projectId))
          );

          projectIds.forEach((projectId, index) => {
            const record = records[index];

            if (!record) {
              emitProjectEvent({
                kind: 'project_deleted',
                projectId,
                timestamp: Date.now(),
              });
              return;
            }

            emitProjectEvent({
              kind: 'project_updated',
              projectId,
              project: record,
              timestamp: Date.now(),
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

        const startPollingFallback = () => {
          pollingTimer = setInterval(() => {
            runSerialized(async () => {
              await emitCurrentProjects();
            });
          }, 3000);
        };

        const start = async () => {
          try {
            await emitCurrentProjects();

            heartbeatTimer = setInterval(() => {
              sendEvent({ type: 'ping', timestamp: Date.now() });
            }, 15000);

            try {
              unsubscribe = await createProjectRealtimeSubscriber({
                projectIds,
                onEvent: async (event) => {
                  runSerialized(async () => {
                    emitProjectEvent(event);
                  });
                },
              });

              if (!unsubscribe) {
                startPollingFallback();
              }
            } catch (error) {
              routeLogger.error('Failed to subscribe to project realtime events', error, {
                projectIds,
              });
              startPollingFallback();
            }
          } catch (error) {
            routeLogger.error('Project realtime stream failed', error, {
              projectIds,
            });
            sendEvent({
              type: 'error',
              message: '读取项目状态失败',
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
