import { and, eq } from 'drizzle-orm';
import { accessError } from '@/lib/api/errors';
import { db } from '@/lib/db';
import { deployments, environments } from '@/lib/db/schema';

export async function getProjectDeploymentContextOrThrow(projectId: string, deploymentId: string) {
  const deployment = await db.query.deployments.findFirst({
    where: and(eq(deployments.id, deploymentId), eq(deployments.projectId, projectId)),
  });

  if (!deployment) {
    throw accessError('not_found', 'Deployment not found');
  }

  const environment = await db.query.environments.findFirst({
    where: and(
      eq(environments.id, deployment.environmentId),
      eq(environments.projectId, projectId)
    ),
  });

  if (!environment) {
    throw accessError('not_found', 'Environment not found');
  }

  return {
    deployment,
    environment,
  };
}
