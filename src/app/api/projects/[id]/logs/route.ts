import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { projects, environments, clusters } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { getK8sClient } from '@/lib/k8s';

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const url = new URL(request.url);
  const podName = url.searchParams.get('pod');
  const containerName = url.searchParams.get('container');
  const environmentId = url.searchParams.get('env');
  const tailLines = url.searchParams.get('tail') || '100';

  const project = await db.query.projects.findFirst({
    where: eq(projects.id, id),
  });

  if (!project) {
    return NextResponse.json({ error: 'Project not found' }, { status: 404 });
  }

  const cluster = await db.query.clusters.findFirst({
    where: eq(clusters.id, project.clusterId || ''),
  });

  if (!cluster) {
    return NextResponse.json({ error: 'No cluster configured' }, { status: 400 });
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

  if (!podName) {
    return NextResponse.json({ error: 'Pod name is required' }, { status: 400 });
  }

  try {
    const { core } = getK8sClient();

    const logResult = await core.readNamespacedPodLog(
      podName,
      environment.namespace,
      containerName || undefined,
      false,
      undefined,
      undefined,
      undefined,
      parseInt(tailLines as string),
      true
    );

    return NextResponse.json({
      pod: podName,
      container: containerName,
      logs: logResult.body,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
