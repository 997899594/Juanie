import { and, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { environments, projects, teamMembers } from '@/lib/db/schema';
import {
  createConfigMap,
  createSecret,
  deleteConfigMap,
  deleteSecret,
  getConfigMaps,
  getK8sClient,
  getSecrets,
} from '@/lib/k8s';

async function authorizeAndGetProject(projectId: string, userId: string) {
  const project = await db.query.projects.findFirst({ where: eq(projects.id, projectId) });
  if (!project) return { project: null, forbidden: false };
  const member = await db.query.teamMembers.findFirst({
    where: and(eq(teamMembers.teamId, project.teamId), eq(teamMembers.userId, userId)),
  });
  return { project, forbidden: !member };
}

async function getEnvironment(projectId: string, environmentId: string | null) {
  if (environmentId) {
    return db.query.environments.findFirst({
      where: eq(environments.id, environmentId),
    });
  }
  const envs = await db.query.environments.findMany({
    where: eq(environments.projectId, projectId),
  });
  return envs[0];
}

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const url = new URL(request.url);
  const resourceType = url.searchParams.get('type') || 'configmaps';
  const environmentId = url.searchParams.get('env');

  const { project, forbidden } = await authorizeAndGetProject(id, session.user.id);

  if (!project) {
    return NextResponse.json({ error: 'Project not found' }, { status: 404 });
  }
  if (forbidden) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const environment = await getEnvironment(id, environmentId);

  if (!environment || !environment.namespace) {
    return NextResponse.json({ error: 'Environment not configured' }, { status: 400 });
  }

  try {
    getK8sClient();
    let data: unknown;

    switch (resourceType) {
      case 'configmaps':
        data = await getConfigMaps(environment.namespace);
        break;
      case 'secrets':
        data = await getSecrets(environment.namespace);
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

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  const { resourceType, name, data, environmentId } = body;

  if (!resourceType || !name || !data) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }

  const { project, forbidden } = await authorizeAndGetProject(id, session.user.id);

  if (!project) {
    return NextResponse.json({ error: 'Project not found' }, { status: 404 });
  }
  if (forbidden) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const environment = await getEnvironment(id, environmentId);

  if (!environment || !environment.namespace) {
    return NextResponse.json({ error: 'Environment not configured' }, { status: 400 });
  }

  try {
    getK8sClient();

    if (resourceType === 'configmap') {
      await createConfigMap(environment.namespace, name, data);
    } else if (resourceType === 'secret') {
      await createSecret(environment.namespace, name, data);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const url = new URL(request.url);
  const resourceType = url.searchParams.get('type') || 'configmap';
  const name = url.searchParams.get('name');
  const environmentId = url.searchParams.get('env');

  if (!name) {
    return NextResponse.json({ error: 'Name required' }, { status: 400 });
  }

  const { project, forbidden } = await authorizeAndGetProject(id, session.user.id);

  if (!project) {
    return NextResponse.json({ error: 'Project not found' }, { status: 404 });
  }
  if (forbidden) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const environment = await getEnvironment(id, environmentId);

  if (!environment || !environment.namespace) {
    return NextResponse.json({ error: 'Environment not configured' }, { status: 400 });
  }

  try {
    getK8sClient();

    if (resourceType === 'configmap') {
      await deleteConfigMap(environment.namespace, name);
    } else if (resourceType === 'secret') {
      await deleteSecret(environment.namespace, name);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
