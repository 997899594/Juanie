import { and, desc, eq } from 'drizzle-orm';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { projects, releases, teamMembers } from '@/lib/db/schema';

export async function GET(request: Request) {
  const session = await auth();

  if (!session?.user?.id) {
    return new Response('Unauthorized', { status: 401 });
  }

  const url = new URL(request.url);
  const projectId = url.searchParams.get('projectId');
  const releaseId = url.searchParams.get('releaseId');

  if (!projectId) {
    return new Response('Project ID required', { status: 400 });
  }

  const project = await db.query.projects.findFirst({
    where: eq(projects.id, projectId),
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

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const sendEvent = (data: object) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      };

      sendEvent({ type: 'connected', timestamp: Date.now() });

      let lastReleaseState: string | null = null;
      let isActive = true;

      const checkReleases = async () => {
        if (!isActive) return;

        const latestRelease = releaseId
          ? await db.query.releases.findFirst({
              where: and(eq(releases.projectId, projectId), eq(releases.id, releaseId)),
              with: {
                environment: true,
                artifacts: {
                  with: {
                    service: true,
                  },
                },
              },
            })
          : await db.query.releases.findFirst({
              where: eq(releases.projectId, projectId),
              orderBy: [desc(releases.createdAt)],
              with: {
                environment: true,
                artifacts: {
                  with: {
                    service: true,
                  },
                },
              },
            });

        if (!latestRelease) {
          return;
        }

        const nextState = [
          latestRelease.id,
          latestRelease.status,
          latestRelease.sourceCommitSha ?? '',
          latestRelease.updatedAt.toISOString(),
          latestRelease.recap && typeof latestRelease.recap === 'object'
            ? String((latestRelease.recap as { generatedAt?: string }).generatedAt ?? '')
            : '',
        ].join(':');

        if (lastReleaseState === nextState) {
          return;
        }

        lastReleaseState = nextState;
        sendEvent({
          type: 'release',
          data: latestRelease,
        });
      };

      await checkReleases();
      const interval = setInterval(checkReleases, 3000);

      request.signal.addEventListener('abort', () => {
        isActive = false;
        clearInterval(interval);
        controller.close();
      });
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
