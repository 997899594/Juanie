import { desc, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { deployments, environments, projects } from '@/lib/db/schema';
import { addDeploymentJob } from '@/lib/queue';

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const url = new URL(request.url);
  const envFilter = url.searchParams.get('env');

  const project = await db.query.projects.findFirst({
    where: eq(projects.id, id),
  });

  if (!project) {
    return NextResponse.json({ error: 'Project not found' }, { status: 404 });
  }

  const result = await db
    .select({
      deployment: deployments,
      environmentName: environments.name,
      environmentNamespace: environments.namespace,
    })
    .from(deployments)
    .innerJoin(environments, eq(environments.id, deployments.environmentId))
    .where(eq(deployments.projectId, id))
    .orderBy(desc(deployments.createdAt));

  const filtered = envFilter ? result.filter((r) => r.environmentName === envFilter) : result;

  return NextResponse.json(filtered);
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { environmentId, version, commitSha, commitMessage } = await request.json();

  if (!environmentId) {
    return NextResponse.json({ error: 'Environment ID is required' }, { status: 400 });
  }

  const environment = await db.query.environments.findFirst({
    where: eq(environments.id, environmentId),
  });

  if (!environment || environment.projectId !== id) {
    return NextResponse.json({ error: 'Environment not found' }, { status: 404 });
  }

  const [deployment] = await db
    .insert(deployments)
    .values({
      projectId: id,
      environmentId,
      version: version || '1.0.0',
      commitSha,
      commitMessage,
      status: 'queued',
      deployedById: session.user.id,
    })
    .returning();

  try {
    await addDeploymentJob(deployment.id, id, environmentId);
  } catch (error) {
    console.error('Failed to queue deployment:', error);
  }

  return NextResponse.json(deployment, { status: 201 });
}
