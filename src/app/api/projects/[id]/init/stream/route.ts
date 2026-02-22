import { eq } from 'drizzle-orm';
import { NextRequest } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { projectInitSteps, projects } from '@/lib/db/schema';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();

  if (!session?.user?.id) {
    return new Response('Unauthorized', { status: 401 });
  }

  const { id } = await params;

  const project = await db.query.projects.findFirst({
    where: eq(projects.id, id),
  });

  if (!project) {
    return new Response('Project not found', { status: 404 });
  }

  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();

      const sendEvent = (data: object) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      };

      const stepWeights: Record<string, number> = {
        validate_repository: 10,
        create_repository: 10,
        push_template: 15,
        setup_namespace: 15,
        deploy_services: 30,
        provision_databases: 20,
        configure_dns: 10,
      };

      const calculateProgress = (steps: (typeof projectInitSteps.$inferSelect)[]) => {
        let completedWeight = 0;
        let totalWeight = 0;

        for (const step of steps) {
          const weight = stepWeights[step.step] || 10;
          totalWeight += weight;
          if (step.status === 'completed') {
            completedWeight += weight;
          } else if (step.status === 'running') {
            completedWeight += weight * ((step.progress ?? 0) / 100);
          }
        }

        return totalWeight > 0 ? Math.round((completedWeight / totalWeight) * 100) : 0;
      };

      let isComplete = false;
      let hasError = false;

      const poll = async () => {
        while (!isComplete && !hasError) {
          try {
            const steps = await db.query.projectInitSteps.findMany({
              where: eq(projectInitSteps.projectId, id),
              orderBy: (steps, { asc }) => [asc(steps.createdAt)],
            });

            if (steps.length === 0) {
              sendEvent({
                type: 'progress',
                steps: [],
                overallProgress: 0,
              });
              await new Promise((r) => setTimeout(r, 1000));
              continue;
            }

            const overallProgress = calculateProgress(steps);

            sendEvent({
              type: 'progress',
              steps: steps.map((s) => ({
                id: s.id,
                step: s.step,
                status: s.status,
                message: s.message,
                progress: s.progress,
                error: s.error,
              })),
              overallProgress,
            });

            const allComplete = steps.every((s) => s.status === 'completed');
            const anyFailed = steps.some((s) => s.status === 'failed');

            if (anyFailed) {
              const failedStep = steps.find((s) => s.status === 'failed');
              sendEvent({
                type: 'error',
                message: failedStep?.error || 'Initialization failed',
              });
              hasError = true;
              controller.close();
              return;
            }

            if (allComplete) {
              await db
                .update(projects)
                .set({ status: 'active', updatedAt: new Date() })
                .where(eq(projects.id, id));

              sendEvent({
                type: 'complete',
                message: 'Project initialized successfully',
              });
              isComplete = true;
              controller.close();
              return;
            }

            await new Promise((r) => setTimeout(r, 1000));
          } catch (err) {
            console.error('Poll error:', err);
            sendEvent({
              type: 'error',
              message: 'Failed to fetch progress',
            });
            hasError = true;
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
