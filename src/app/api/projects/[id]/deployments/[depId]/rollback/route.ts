import { and, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { deployments, projects, teamMembers } from '@/lib/db/schema';
import { addDeploymentJob } from '@/lib/queue';

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

  // Mark currently running deployments in the same environment as rolled_back
  await db
    .update(deployments)
    .set({ status: 'rolled_back' })
    .where(
      and(
        eq(deployments.projectId, id),
        eq(deployments.environmentId, targetDeployment.environmentId),
        eq(deployments.status, 'running')
      )
    );

  // Create a new deployment record reusing the target's image (no rebuild)
  const [newDeployment] = await db
    .insert(deployments)
    .values({
      projectId: id,
      environmentId: targetDeployment.environmentId,
      status: 'queued',
      imageUrl: targetDeployment.imageUrl,
      commitSha: targetDeployment.commitSha,
      commitMessage: targetDeployment.commitMessage,
      branch: targetDeployment.branch,
      version: targetDeployment.version,
      deployedById: session.user.id,
    })
    .returning();

  await addDeploymentJob(newDeployment.id, id, targetDeployment.environmentId);

  return NextResponse.json({
    success: true,
    deploymentId: newDeployment.id,
    imageUrl: targetDeployment.imageUrl,
  });
}
