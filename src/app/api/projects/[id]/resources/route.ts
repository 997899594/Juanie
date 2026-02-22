import { eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { environments, projects } from '@/lib/db/schema';
import { getDeployments, getEvents, getK8sClient, getPods, getServices } from '@/lib/k8s';

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const url = new URL(request.url);
  const resourceType = url.searchParams.get('type') || 'pods';
  const environmentId = url.searchParams.get('env');

  const project = await db.query.projects.findFirst({
    where: eq(projects.id, id),
  });

  if (!project) {
    return NextResponse.json({ error: 'Project not found' }, { status: 404 });
  }

  let environment = null;
  if (environmentId) {
    environment = await db.query.environments.findFirst({
      where: eq(environments.id, environmentId),
    });
  } else {
    const envs = await db.query.environments.findMany({
      where: eq(environments.projectId, id),
    });
    environment = envs[0];
  }

  if (!environment || !environment.namespace) {
    return NextResponse.json({ error: 'Environment not configured' }, { status: 400 });
  }

  try {
    getK8sClient();
    let data: unknown;

    switch (resourceType) {
      case 'pods':
        data = await getPods(environment.namespace);
        break;
      case 'services':
        data = await getServices(environment.namespace);
        break;
      case 'deployments':
        data = await getDeployments(environment.namespace);
        break;
      case 'events':
        data = await getEvents(environment.namespace);
        break;
      default:
        return NextResponse.json({ error: 'Invalid resource type' }, { status: 400 });
    }

    return NextResponse.json(data);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
