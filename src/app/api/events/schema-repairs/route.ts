import { NextRequest } from 'next/server';
import { getProjectAccessOrThrow, requireSession } from '@/lib/api/access';
import { isAccessError } from '@/lib/api/errors';
import { logger } from '@/lib/logger';
import {
  createSchemaRepairRealtimeSubscriber,
  loadProjectSchemaRepairRealtimeRecords,
} from '@/lib/realtime/schema-repairs';
import { buildSchemaRepairRealtimeStateKey } from '@/lib/schema-safety/realtime';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const routeLogger = logger.child({ route: 'api/events/schema-repairs' });

export async function GET(request: NextRequest) {
  try {
    const session = await requireSession();
    const url = new URL(request.url);
    const projectId = url.searchParams.get('projectId');
    const environmentId = url.searchParams.get('envId');

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
        const lastStateByDatabaseId = new Map<string, string>();

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
            routeLogger.error('Schema repair stream task failed', error, {
              environmentId,
              projectId,
            });
          });
        };

        const emitRepair = async (
          repair: Awaited<ReturnType<typeof loadProjectSchemaRepairRealtimeRecords>>[number]
        ) => {
          if (environmentId && repair.environmentId !== environmentId) {
            return;
          }

          const nextStateKey = buildSchemaRepairRealtimeStateKey(repair);
          if (lastStateByDatabaseId.get(repair.id) === nextStateKey) {
            return;
          }

          lastStateByDatabaseId.set(repair.id, nextStateKey);
          sendEvent({
            type: 'schemaRepair',
            data: repair,
          });
        };

        const emitCurrentRepairs = async () => {
          const repairs = await loadProjectSchemaRepairRealtimeRecords({
            projectId,
            environmentId,
          });

          for (const repair of repairs) {
            await emitRepair(repair);
          }
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
              await emitCurrentRepairs();
            });
          }, 3000);
        };

        const start = async () => {
          try {
            await emitCurrentRepairs();

            heartbeatTimer = setInterval(() => {
              sendEvent({ type: 'ping', timestamp: Date.now() });
            }, 15000);

            try {
              unsubscribe = await createSchemaRepairRealtimeSubscriber({
                projectId,
                onEvent: async (event) => {
                  runSerialized(async () => {
                    await emitRepair(event.repair);
                  });
                },
              });

              if (!unsubscribe) {
                startPollingFallback();
              }
            } catch (error) {
              routeLogger.error('Failed to subscribe to schema repair realtime events', error, {
                environmentId,
                projectId,
              });
              startPollingFallback();
            }
          } catch (error) {
            routeLogger.error('Schema repair realtime stream failed', error, {
              environmentId,
              projectId,
            });
            sendEvent({
              type: 'error',
              message: '读取 schema repair 状态失败',
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
