import { and, asc, desc, eq } from 'drizzle-orm';
import type Redis from 'ioredis';
import { db } from '@/lib/db';
import { deploymentLogs, deployments, environments, services } from '@/lib/db/schema';
import { createRedisClient, isRedisConfigured } from '@/lib/redis/config';

const DEPLOYMENT_CHANNEL_PREFIX = 'realtime:deployments:project:';
const DEPLOYMENT_LOG_CHANNEL_PREFIX = 'realtime:deployment-logs:deployment:';

export interface DeploymentRealtimeSummary {
  id: string;
  projectId: string;
  status: string;
  version: string | null;
  commitSha: string | null;
  environmentId: string;
  serviceId: string | null;
  createdAt: string;
  deployedAt: string | null;
  environmentName: string | null;
  serviceName: string | null;
}

export interface DeploymentRealtimeLog {
  id: string;
  deploymentId: string;
  level: string;
  message: string;
  createdAt: string;
}

export interface DeploymentRealtimeEvent {
  kind: 'deployment_updated';
  projectId: string;
  deployment: DeploymentRealtimeSummary;
  timestamp: number;
}

export type DeploymentLogRealtimeEvent =
  | {
      kind: 'deployment_log_appended';
      deploymentId: string;
      log: DeploymentRealtimeLog;
      timestamp: number;
    }
  | {
      kind: 'deployment_status_updated';
      deploymentId: string;
      status: string;
      timestamp: number;
    };

let publisher: Redis | null = null;

export function buildDeploymentRealtimeChannel(projectId: string): string {
  return `${DEPLOYMENT_CHANNEL_PREFIX}${projectId}`;
}

export function buildDeploymentLogRealtimeChannel(deploymentId: string): string {
  return `${DEPLOYMENT_LOG_CHANNEL_PREFIX}${deploymentId}`;
}

function getPublisher(): Redis | null {
  if (!isRedisConfigured()) {
    return null;
  }

  if (!publisher) {
    publisher = createRedisClient({
      lazyConnect: true,
      maxRetriesPerRequest: 1,
    });
  }

  return publisher;
}

export async function loadDeploymentRealtimeSummary(
  deploymentId: string
): Promise<DeploymentRealtimeSummary | null> {
  const deployment = await db.query.deployments.findFirst({
    where: eq(deployments.id, deploymentId),
    columns: {
      id: true,
      projectId: true,
      status: true,
      version: true,
      commitSha: true,
      environmentId: true,
      serviceId: true,
      createdAt: true,
      deployedAt: true,
    },
  });

  if (!deployment) {
    return null;
  }

  const [environment, service] = await Promise.all([
    db.query.environments.findFirst({
      where: eq(environments.id, deployment.environmentId),
      columns: {
        id: true,
        name: true,
      },
    }),
    deployment.serviceId
      ? db.query.services.findFirst({
          where: eq(services.id, deployment.serviceId),
          columns: {
            id: true,
            name: true,
          },
        })
      : null,
  ]);

  return {
    id: deployment.id,
    projectId: deployment.projectId,
    status: deployment.status,
    version: deployment.version,
    commitSha: deployment.commitSha ?? null,
    environmentId: deployment.environmentId,
    serviceId: deployment.serviceId ?? null,
    createdAt: deployment.createdAt.toISOString(),
    deployedAt: deployment.deployedAt?.toISOString() ?? null,
    environmentName: environment?.name ?? null,
    serviceName: service?.name ?? null,
  };
}

export async function loadLatestProjectDeploymentRealtimeSummary(
  projectId: string
): Promise<DeploymentRealtimeSummary | null> {
  const latest = await db.query.deployments.findFirst({
    where: eq(deployments.projectId, projectId),
    columns: {
      id: true,
    },
    orderBy: [desc(deployments.createdAt)],
  });

  if (!latest) {
    return null;
  }

  return loadDeploymentRealtimeSummary(latest.id);
}

export async function loadDeploymentRealtimeLogs(
  deploymentId: string
): Promise<DeploymentRealtimeLog[]> {
  const logs = await db.query.deploymentLogs.findMany({
    where: eq(deploymentLogs.deploymentId, deploymentId),
    orderBy: [asc(deploymentLogs.createdAt)],
  });

  return logs.map((log) => ({
    id: log.id,
    deploymentId: log.deploymentId,
    level: log.level,
    message: log.message,
    createdAt: log.createdAt.toISOString(),
  }));
}

async function publishDeploymentLogEvent(event: DeploymentLogRealtimeEvent) {
  const client = getPublisher();
  if (!client) {
    return;
  }

  await client.publish(
    buildDeploymentLogRealtimeChannel(event.deploymentId),
    JSON.stringify(event)
  );
}

export async function publishDeploymentRealtimeSnapshot(deploymentId: string): Promise<void> {
  const client = getPublisher();
  const summary = await loadDeploymentRealtimeSummary(deploymentId);

  if (!client || !summary) {
    return;
  }

  await client.publish(
    buildDeploymentRealtimeChannel(summary.projectId),
    JSON.stringify({
      kind: 'deployment_updated',
      projectId: summary.projectId,
      deployment: summary,
      timestamp: Date.now(),
    } satisfies DeploymentRealtimeEvent)
  );

  await publishDeploymentLogEvent({
    kind: 'deployment_status_updated',
    deploymentId: summary.id,
    status: summary.status,
    timestamp: Date.now(),
  });
}

export async function updateDeploymentRealtimeState(
  deploymentId: string,
  patch: Partial<
    Pick<
      typeof deployments.$inferSelect,
      'status' | 'errorMessage' | 'deployedAt' | 'imageUrl' | 'commitSha' | 'commitMessage'
    >
  >
): Promise<void> {
  await db.update(deployments).set(patch).where(eq(deployments.id, deploymentId));

  await publishDeploymentRealtimeSnapshot(deploymentId);
}

export async function appendDeploymentRealtimeLogs(
  entries: Array<{
    deploymentId: string;
    level: string;
    message: string;
  }>
): Promise<DeploymentRealtimeLog[]> {
  if (entries.length === 0) {
    return [];
  }

  const inserted = await db.insert(deploymentLogs).values(entries).returning({
    id: deploymentLogs.id,
    deploymentId: deploymentLogs.deploymentId,
    level: deploymentLogs.level,
    message: deploymentLogs.message,
    createdAt: deploymentLogs.createdAt,
  });

  const payload = inserted.map((log) => ({
    id: log.id,
    deploymentId: log.deploymentId,
    level: log.level,
    message: log.message,
    createdAt: log.createdAt.toISOString(),
  }));

  await Promise.all(
    payload.map((log) =>
      publishDeploymentLogEvent({
        kind: 'deployment_log_appended',
        deploymentId: log.deploymentId,
        log,
        timestamp: Date.now(),
      })
    )
  );

  return payload;
}

export async function createDeploymentRealtimeSubscriber(input: {
  projectId: string;
  onEvent: (event: DeploymentRealtimeEvent) => void | Promise<void>;
}): Promise<(() => Promise<void>) | null> {
  if (!isRedisConfigured()) {
    return null;
  }

  const subscriber = createRedisClient({
    lazyConnect: true,
    maxRetriesPerRequest: 1,
  });
  const channel = buildDeploymentRealtimeChannel(input.projectId);

  const handleMessage = async (receivedChannel: string, payload: string) => {
    if (receivedChannel !== channel) {
      return;
    }

    try {
      const parsed = JSON.parse(payload) as DeploymentRealtimeEvent;
      await input.onEvent(parsed);
    } catch (error) {
      console.error('Failed to handle deployment realtime event:', error);
    }
  };

  subscriber.on('message', handleMessage);
  await subscriber.subscribe(channel);

  return async () => {
    subscriber.off('message', handleMessage);
    await subscriber.unsubscribe(channel).catch(() => undefined);
    subscriber.disconnect();
  };
}

export async function createDeploymentLogRealtimeSubscriber(input: {
  deploymentId: string;
  onEvent: (event: DeploymentLogRealtimeEvent) => void | Promise<void>;
}): Promise<(() => Promise<void>) | null> {
  if (!isRedisConfigured()) {
    return null;
  }

  const subscriber = createRedisClient({
    lazyConnect: true,
    maxRetriesPerRequest: 1,
  });
  const channel = buildDeploymentLogRealtimeChannel(input.deploymentId);

  const handleMessage = async (receivedChannel: string, payload: string) => {
    if (receivedChannel !== channel) {
      return;
    }

    try {
      const parsed = JSON.parse(payload) as DeploymentLogRealtimeEvent;
      await input.onEvent(parsed);
    } catch (error) {
      console.error('Failed to handle deployment log realtime event:', error);
    }
  };

  subscriber.on('message', handleMessage);
  await subscriber.subscribe(channel);

  return async () => {
    subscriber.off('message', handleMessage);
    await subscriber.unsubscribe(channel).catch(() => undefined);
    subscriber.disconnect();
  };
}

export async function publishDeploymentsRealtimeSnapshots(deploymentIds: string[]): Promise<void> {
  await Promise.all(
    deploymentIds.map((deploymentId) => publishDeploymentRealtimeSnapshot(deploymentId))
  );
}

export async function appendDeploymentRealtimeWarning(
  deploymentId: string,
  message: string
): Promise<void> {
  await appendDeploymentRealtimeLogs([
    {
      deploymentId,
      level: 'warn',
      message,
    },
  ]);
}

export async function loadScopedDeploymentRealtimeLogs(input: {
  projectId: string;
  deploymentId: string;
}): Promise<DeploymentRealtimeLog[]> {
  const deployment = await db.query.deployments.findFirst({
    where: and(eq(deployments.id, input.deploymentId), eq(deployments.projectId, input.projectId)),
    columns: {
      id: true,
    },
  });

  if (!deployment) {
    return [];
  }

  return loadDeploymentRealtimeLogs(deployment.id);
}
