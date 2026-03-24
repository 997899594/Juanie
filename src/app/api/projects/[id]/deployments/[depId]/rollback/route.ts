import { and, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { deployments, projects, teamMembers } from '@/lib/db/schema';
import { createProjectRelease } from '@/lib/releases';

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string; depId: string }> }
) {
  const { id, depId } = await params;
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const project = await db.query.projects.findFirst({
    where: eq(projects.id, id),
    with: {
      repository: true,
    },
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

  const targetDeployment = await db.query.deployments.findFirst({
    where: eq(deployments.id, depId),
  });

  if (!targetDeployment) {
    return NextResponse.json({ error: 'Deployment not found' }, { status: 404 });
  }

  if (targetDeployment.projectId !== id) {
    return NextResponse.json({ error: 'Deployment not found' }, { status: 404 });
  }

  if (!targetDeployment.imageUrl) {
    return NextResponse.json(
      { error: 'Deployment has no image URL — cannot roll back to this version' },
      { status: 400 }
    );
  }

  const release = await createProjectRelease({
    projectId: id,
    environmentId: targetDeployment.environmentId,
    services: [
      {
        id: targetDeployment.serviceId ?? undefined,
        image: targetDeployment.imageUrl,
      },
    ],
    sourceRepository: project.repository?.fullName ?? project.name,
    sourceRef: targetDeployment.branch
      ? `refs/heads/${targetDeployment.branch}`
      : `refs/heads/${project.productionBranch ?? 'main'}`,
    sourceCommitSha: targetDeployment.commitSha ?? null,
    configCommitSha: targetDeployment.commitSha ?? null,
    triggeredBy: 'manual',
    triggeredByUserId: session.user.id,
    summary: `Rollback to ${targetDeployment.commitSha?.slice(0, 7) ?? 'previous image'}`,
  });

  return NextResponse.json(
    {
      success: true,
      releaseId: release?.id,
      imageUrl: targetDeployment.imageUrl,
    },
    { status: 202 }
  );
}
