import { eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { projectInitSteps, projects } from '@/lib/db/schema';

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;

  const project = await db.query.projects.findFirst({
    where: eq(projects.id, id),
  });

  if (!project) {
    return NextResponse.json({ error: 'Project not found' }, { status: 404 });
  }

  const steps = await db.query.projectInitSteps.findMany({
    where: eq(projectInitSteps.projectId, id),
    orderBy: (steps, { asc }) => [asc(steps.createdAt)],
  });

  const stepWeights: Record<string, number> = {
    validate_repository: 10,
    create_repository: 10,
    push_template: 15,
    setup_namespace: 15,
    deploy_services: 30,
    provision_databases: 20,
    configure_dns: 10,
  };

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

  const overallProgress = totalWeight > 0 ? Math.round((completedWeight / totalWeight) * 100) : 0;

  const allComplete = steps.length > 0 && steps.every((s) => s.status === 'completed');
  const anyFailed = steps.some((s) => s.status === 'failed');

  return NextResponse.json({
    steps,
    overallProgress,
    status: anyFailed ? 'failed' : allComplete ? 'active' : 'initializing',
  });
}
