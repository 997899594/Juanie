import { Writable } from 'node:stream';
import * as k8s from '@kubernetes/client-node';
import { and, eq } from 'drizzle-orm';
import type { NextRequest } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { environments, projects, teamMembers } from '@/lib/db/schema';
import { getIsConnected, getK8sClient, initK8sClient } from '@/lib/k8s';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return new Response('Unauthorized', { status: 401 });
  }

  const { id } = await params;
  const url = new URL(request.url);
  const envId = url.searchParams.get('envId');
  const podName = url.searchParams.get('pod');
  const container = url.searchParams.get('container') ?? '';
  const tail = Math.min(parseInt(url.searchParams.get('tail') ?? '100', 10), 1000);

  if (!envId || !podName) {
    return new Response('envId and pod are required', { status: 400 });
  }

  const project = await db.query.projects.findFirst({ where: eq(projects.id, id) });
  if (!project) return new Response('Project not found', { status: 404 });

  const member = await db.query.teamMembers.findFirst({
    where: and(eq(teamMembers.teamId, project.teamId), eq(teamMembers.userId, session.user.id)),
  });
  if (!member) return new Response('Forbidden', { status: 403 });

  const env = await db.query.environments.findFirst({
    where: and(eq(environments.id, envId), eq(environments.projectId, id)),
  });
  if (!env?.namespace) {
    return new Response('Environment has no namespace (not yet deployed)', { status: 400 });
  }

  initK8sClient();
  if (!getIsConnected()) {
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
      request.signal.addEventListener('abort', () => {
        k8sAbort?.abort();
        writable.destroy();
        close();
      });

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
}
