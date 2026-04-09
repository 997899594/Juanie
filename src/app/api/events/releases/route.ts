import { and, desc, eq } from 'drizzle-orm';
import { getProjectAccessOrThrow, requireSession } from '@/lib/api/access';
import { isAccessError } from '@/lib/api/errors';
import { db } from '@/lib/db';
import { releases } from '@/lib/db/schema';

export async function GET(request: Request) {
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
  } catch (error) {
    if (isAccessError(error)) {
      return new Response(error.message, { status: error.status });
    }

    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(errorMessage, { status: 500 });
  }
}
