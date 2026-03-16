import { and, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { environments, projects, teamMembers } from '@/lib/db/schema';
import { getK8sClient, getPodLogs } from '@/lib/k8s';

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const url = new URL(request.url);
  const podName = url.searchParams.get('pod');
  const containerName = url.searchParams.get('container');
  const tailLines = parseInt(url.searchParams.get('tail') || '100', 10);
  const environmentId = url.searchParams.get('env');

  if (!podName) {
    return NextResponse.json({ error: 'Pod name required' }, { status: 400 });
  }

  const project = await db.query.projects.findFirst({
    where: eq(projects.id, id),
  });

  if (!project) {
    return NextResponse.json({ error: 'Project not found' }, { status: 404 });
  }

  const member = await db.query.teamMembers.findFirst({
    where: and(eq(teamMembers.teamId, project.teamId), eq(teamMembers.userId, session.user.id)),
  });

  if (!member) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
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
    const logs = await getPodLogs(
      environment.namespace,
      podName,
      containerName || undefined,
      tailLines,
      false
    );

    return new NextResponse(logs as string, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
      },
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    // K8s returns 400 when the container hasn't started yet (e.g. ImagePullBackOff / Pending)
    if (errorMessage.includes('HTTP-Code: 400') || errorMessage.includes('is not running')) {
      return NextResponse.json(
        { error: 'Container has not started yet — check pod status for details' },
        { status: 400 }
      );
    }
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
