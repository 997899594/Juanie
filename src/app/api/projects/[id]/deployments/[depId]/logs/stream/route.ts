import { and, asc, eq } from 'drizzle-orm';
import { NextRequest } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { deploymentLogs, deployments, projects, teamMembers } from '@/lib/db/schema';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; depId: string }> }
) {
  const session = await auth();

  if (!session?.user?.id) {
    return new Response('Unauthorized', { status: 401 });
  }

  const { id, depId } = await params;

  const project = await db.query.projects.findFirst({
    where: eq(projects.id, id),
  });

  if (!project) {
    return new Response('Project not found', { status: 404 });
  }

  const member = await db.query.teamMembers.findFirst({
    where: and(eq(teamMembers.teamId, project.teamId), eq(teamMembers.userId, session.user.id)),
  });

  if (!member) {
    return new Response('Forbidden', { status: 403 });
  }

  const deployment = await db.query.deployments.findFirst({
    where: and(eq(deployments.id, depId), eq(deployments.projectId, id)),
  });

  if (!deployment) {
    return new Response('Deployment not found', { status: 404 });
  }

  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();

      const sendEvent = (data: object) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      };

      let sentCount = 0;
      let done = false;

      const poll = async () => {
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
              current?.status === 'failed' ||
              current?.status === 'migration_failed' ||
              current?.status === 'rolled_back'
            ) {
              sendEvent({ type: 'complete', status: current.status });
              done = true;
              controller.close();
              return;
            }

            await new Promise((r) => setTimeout(r, 1000));
          } catch (err) {
            console.error('Log stream poll error:', err);
            sendEvent({ type: 'error', message: 'Failed to fetch logs' });
            done = true;
            controller.close();
          }
        }
      };

      poll();
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  });
}
