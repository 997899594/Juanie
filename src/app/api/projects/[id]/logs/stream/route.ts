import { Writable } from 'node:stream';
import * as k8s from '@kubernetes/client-node';
import { and, eq } from 'drizzle-orm';
import type { NextRequest } from 'next/server';
import { getProjectAccessOrThrow, requireSession } from '@/lib/api/access';
import { isAccessError } from '@/lib/api/errors';
import { db } from '@/lib/db';
import { environments } from '@/lib/db/schema';
import { getK8sClient, isK8sAvailable } from '@/lib/k8s';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireSession();
    const { id } = await params;
    await getProjectAccessOrThrow(id, session.user.id);

    const url = new URL(request.url);
    const envId = url.searchParams.get('envId');
    const podName = url.searchParams.get('pod');
    const container = url.searchParams.get('container') ?? '';
    const tail = Math.min(parseInt(url.searchParams.get('tail') ?? '100', 10), 1000);

    if (!envId || !podName) {
      return new Response('envId and pod are required', { status: 400 });
    }

    const env = await db.query.environments.findFirst({
      where: and(eq(environments.id, envId), eq(environments.projectId, id)),
    });
    if (!env?.namespace) {
      return new Response('Environment has no namespace (not yet deployed)', { status: 400 });
    }

    if (!isK8sAvailable()) {
      return new Response('Kubernetes not connected', { status: 503 });
    }

    const encoder = new TextEncoder();
    let closed = false;

    const stream = new ReadableStream({
      async start(controller) {
        const send = (data: object) => {
          if (closed) return;
          try {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
          } catch {
            // controller already closed
          }
        };

        const close = () => {
          if (closed) return;
          closed = true;
          try {
            controller.close();
          } catch {
            // already closed
          }
        };

        send({ type: 'connected', pod: podName, namespace: env.namespace });

        // Node.js Writable — each write() call is one chunk from the K8s response body.
        // We split on newlines so each log line becomes its own SSE event.
        const writable = new Writable({
          write(chunk: Buffer, _enc, cb) {
            const text = chunk.toString('utf8');
            for (const line of text.split('\n')) {
              if (line) send({ type: 'line', text: line });
            }
            cb();
          },
          final(cb) {
            send({ type: 'end' });
            close();
            cb();
          },
        });

        writable.on('error', (err) => {
          send({ type: 'error', message: err.message });
          close();
        });

        // When the browser closes the connection, abort the K8s stream.
        let k8sAbort: { abort(): void } | null = null;
        const onAbort = () => {
          k8sAbort?.abort();
          writable.destroy();
          close();
        };
        request.signal.addEventListener('abort', onAbort, { once: true });

        try {
          const { config } = getK8sClient();
          const logger = new k8s.Log(config);

          // logger.log() makes the HTTP request and begins piping K8s response → writable.
          // It returns an AbortController we can use to cancel the stream.
          k8sAbort = await logger.log(env.namespace!, podName, container, writable, {
            follow: true,
            tailLines: tail,
            timestamps: false,
          });
        } catch (err) {
          send({ type: 'error', message: err instanceof Error ? err.message : String(err) });
          close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
        'X-Accel-Buffering': 'no', // disable Nginx buffering
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
