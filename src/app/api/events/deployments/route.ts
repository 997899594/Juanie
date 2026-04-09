import { desc, eq } from 'drizzle-orm';
import { getProjectAccessOrThrow, requireSession } from '@/lib/api/access';
import { isAccessError } from '@/lib/api/errors';
import { db } from '@/lib/db';
import { deployments, environments, services } from '@/lib/db/schema';

export async function GET(request: Request) {
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
        const sendEvent = (data: object) => {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
        };

        sendEvent({ type: 'connected', timestamp: Date.now() });

        let lastDeploymentState: string | null = null;
        let isActive = true;

        const checkDeployments = async () => {
          if (!isActive) return;

          const recentDeployments = await db
            .select({
              id: deployments.id,
              status: deployments.status,
              version: deployments.version,
              commitSha: deployments.commitSha,
              environmentId: deployments.environmentId,
              serviceId: deployments.serviceId,
              createdAt: deployments.createdAt,
              deployedAt: deployments.deployedAt,
            })
            .from(deployments)
            .where(eq(deployments.projectId, projectId))
            .orderBy(desc(deployments.createdAt))
            .limit(1);

          if (recentDeployments.length > 0) {
            const latest = recentDeployments[0];
            const nextState = [
              latest.id,
              latest.status,
              latest.commitSha,
              latest.deployedAt?.toISOString() ?? '',
            ].join(':');

            if (lastDeploymentState !== nextState) {
              lastDeploymentState = nextState;

              const env = await db.query.environments.findFirst({
                where: eq(environments.id, latest.environmentId),
              });
              const service = latest.serviceId
                ? await db.query.services.findFirst({
                    where: eq(services.id, latest.serviceId),
                  })
                : null;

              sendEvent({
                type: 'deployment',
                data: {
                  ...latest,
                  environmentName: env?.name,
                  serviceName: service?.name ?? null,
                },
              });
            }
          }
        };

        const interval = setInterval(checkDeployments, 3000);

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
