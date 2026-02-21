import { and, desc, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { clusters, deployments, environments, projects } from '@/lib/db/schema';
import { createGitRepository, createKustomization, reconcileKustomization } from '@/lib/flux';
import { createNamespace, createSecret, initK8sClient } from '@/lib/k8s';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string; deploymentId: string }> }
) {
  const { id, deploymentId } = await params;
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const deployment = await db.query.deployments.findFirst({
    where: and(eq(deployments.id, deploymentId), eq(deployments.projectId, id)),
  });

  if (!deployment) {
    return NextResponse.json({ error: 'Deployment not found' }, { status: 404 });
  }

  if (deployment.status !== 'deployed') {
    return NextResponse.json({ error: 'Can only rollback deployed deployments' }, { status: 400 });
  }

  const project = await db.query.projects.findFirst({
    where: eq(projects.id, id),
  });

  if (!project) {
    return NextResponse.json({ error: 'Project not found' }, { status: 404 });
  }

  const environment = await db.query.environments.findFirst({
    where: eq(environments.id, deployment.environmentId),
  });

  if (!environment || !environment.namespace) {
    return NextResponse.json({ error: 'Environment not configured' }, { status: 400 });
  }

  const cluster = await db.query.clusters.findFirst({
    where: eq(clusters.id, project.clusterId || ''),
  });

  if (!cluster) {
    return NextResponse.json({ error: 'No cluster configured' }, { status: 400 });
  }

  try {
    initK8sClient(cluster.kubeconfig);

    await reconcileKustomization(project.slug, environment.namespace);

    const [rollbackDeployment] = await db
      .insert(deployments)
      .values({
        projectId: id,
        environmentId: deployment.environmentId,
        version: deployment.version,
        commitSha: deployment.commitSha,
        commitMessage: `Rollback to ${deployment.version}`,
        status: 'deploying',
        deployedById: session.user.id,
      })
      .returning();

    return NextResponse.json({
      success: true,
      deployment: rollbackDeployment,
      message: `Rollback to version ${deployment.version} triggered`,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string; deploymentId: string }> }
) {
  const { id, deploymentId } = await params;
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const deployment = await db.query.deployments.findFirst({
    where: and(eq(deployments.id, deploymentId), eq(deployments.projectId, id)),
  });

  if (!deployment) {
    return NextResponse.json({ error: 'Deployment not found' }, { status: 404 });
  }

  const environment = await db.query.environments.findFirst({
    where: eq(environments.id, deployment.environmentId),
  });

  return NextResponse.json({
    ...deployment,
    environmentName: environment?.name,
  });
}
