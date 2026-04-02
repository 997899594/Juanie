import { and, eq, gt, inArray, isNull, lt, ne } from 'drizzle-orm';
import { db } from '@/lib/db';
import { type DeploymentStatus, deploymentLogs, deployments } from '@/lib/db/schema';

type DeploymentScope = Pick<
  typeof deployments.$inferSelect,
  'id' | 'projectId' | 'environmentId' | 'serviceId' | 'createdAt' | 'status'
>;

const cancelableDeploymentStatuses: DeploymentStatus[] = [
  'queued',
  'migration_pending',
  'migration_running',
  'migration_failed',
  'building',
  'deploying',
  'awaiting_rollout',
];

function buildScopeConditions(target: DeploymentScope) {
  return [
    eq(deployments.projectId, target.projectId),
    eq(deployments.environmentId, target.environmentId),
    target.serviceId ? eq(deployments.serviceId, target.serviceId) : isNull(deployments.serviceId),
  ];
}

async function writeCancellationLogs(deploymentIds: string[], message: string): Promise<void> {
  if (deploymentIds.length === 0) {
    return;
  }

  await db
    .insert(deploymentLogs)
    .values(deploymentIds.map((deploymentId) => ({ deploymentId, level: 'warn', message })))
    .catch(() => {
      // Ignore log write failures so cancellation is never blocked by diagnostics.
    });
}

async function markDeploymentCanceled(
  deploymentId: string,
  errorMessage: string,
  logMessage: string
): Promise<void> {
  await db
    .update(deployments)
    .set({
      status: 'canceled',
      errorMessage,
    })
    .where(
      and(
        eq(deployments.id, deploymentId),
        inArray(deployments.status, cancelableDeploymentStatuses)
      )
    );

  await writeCancellationLogs([deploymentId], logMessage);
}

export class SupersededDeploymentError extends Error {
  constructor(
    message: string,
    readonly supersedingDeploymentId: string
  ) {
    super(message);
    this.name = 'SupersededDeploymentError';
  }
}

export async function cancelSupersededDeployments(target: DeploymentScope): Promise<string[]> {
  const candidates = await db.query.deployments.findMany({
    where: and(
      ne(deployments.id, target.id),
      ...buildScopeConditions(target),
      lt(deployments.createdAt, target.createdAt),
      inArray(deployments.status, cancelableDeploymentStatuses)
    ),
    columns: {
      id: true,
    },
  });

  if (candidates.length === 0) {
    return [];
  }

  const candidateIds = candidates.map((candidate) => candidate.id);
  const errorMessage = `Superseded by deployment ${target.id}`;
  const logMessage = `Canceled because newer deployment ${target.id} took ownership of this environment`;

  await db
    .update(deployments)
    .set({
      status: 'canceled',
      errorMessage,
    })
    .where(
      and(
        inArray(deployments.id, candidateIds),
        inArray(deployments.status, cancelableDeploymentStatuses)
      )
    );

  await writeCancellationLogs(candidateIds, logMessage);

  return candidateIds;
}

export async function assertDeploymentIsCurrent(deploymentId: string): Promise<DeploymentScope> {
  const deployment = await db.query.deployments.findFirst({
    where: eq(deployments.id, deploymentId),
    columns: {
      id: true,
      projectId: true,
      environmentId: true,
      serviceId: true,
      createdAt: true,
      status: true,
      errorMessage: true,
    },
  });

  if (!deployment) {
    throw new Error(`Deployment ${deploymentId} not found`);
  }

  if (deployment.status === 'canceled') {
    throw new SupersededDeploymentError(
      deployment.errorMessage ?? `Deployment ${deployment.id} was canceled`,
      deployment.id
    );
  }

  const supersedingDeployment = await db.query.deployments.findFirst({
    where: and(
      ne(deployments.id, deployment.id),
      ...buildScopeConditions(deployment),
      gt(deployments.createdAt, deployment.createdAt)
    ),
    columns: {
      id: true,
    },
    orderBy: (table, { desc: orderDesc }) => [orderDesc(table.createdAt), orderDesc(table.id)],
  });

  if (!supersedingDeployment) {
    return deployment;
  }

  const errorMessage = `Superseded by deployment ${supersedingDeployment.id}`;
  const logMessage = `Canceled because newer deployment ${supersedingDeployment.id} took ownership of this environment`;
  await markDeploymentCanceled(deployment.id, errorMessage, logMessage);

  throw new SupersededDeploymentError(errorMessage, supersedingDeployment.id);
}
