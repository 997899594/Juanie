import { and, asc, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { deploymentLogs, deployments, projects, teamMembers } from '@/lib/db/schema';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string; depId: string }> }
) {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id, depId } = await params;

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

  const deployment = await db.query.deployments.findFirst({
    where: and(eq(deployments.id, depId), eq(deployments.projectId, id)),
  });

  if (!deployment) {
    return NextResponse.json({ error: 'Deployment not found' }, { status: 404 });
  }

  const logs = await db.query.deploymentLogs.findMany({
    where: eq(deploymentLogs.deploymentId, depId),
    orderBy: [asc(deploymentLogs.createdAt)],
  });

  return NextResponse.json(logs);
}
