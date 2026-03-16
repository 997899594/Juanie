import { and, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { environments, projects, teamMembers } from '@/lib/db/schema';
import { execInPod } from '@/lib/k8s';

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  const { podName, containerName, command, environmentId } = body;

  if (!podName || !command) {
    return NextResponse.json({ error: 'Pod name and command required' }, { status: 400 });
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
    const commandArray = Array.isArray(command) ? command : command.split(' ');
    const result = await execInPod(
      environment.namespace,
      podName,
      containerName || 'main',
      commandArray
    );

    return NextResponse.json({ output: result });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
