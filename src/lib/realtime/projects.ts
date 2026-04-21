import { eq } from 'drizzle-orm';
import type Redis from 'ioredis';
import { db } from '@/lib/db';
import { projects } from '@/lib/db/schema';
import { logger } from '@/lib/logger';
import { createRedisClient, isRedisConfigured } from '@/lib/redis/config';

const PROJECT_CHANNEL_PREFIX = 'realtime:projects:project:';
const projectsRealtimeLogger = logger.child({ component: 'realtime-projects' });

export interface ProjectRealtimeRecord {
  id: string;
  name: string;
  status: string | null;
  updatedAt: string;
}

export interface ProjectUpdatedRealtimeEvent {
  kind: 'project_updated';
  projectId: string;
  project: ProjectRealtimeRecord;
  timestamp: number;
}

export interface ProjectDeletedRealtimeEvent {
  kind: 'project_deleted';
  projectId: string;
  timestamp: number;
}

export type ProjectRealtimeEvent = ProjectUpdatedRealtimeEvent | ProjectDeletedRealtimeEvent;

let publisher: Redis | null = null;

export function buildProjectRealtimeChannel(projectId: string): string {
  return `${PROJECT_CHANNEL_PREFIX}${projectId}`;
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

export async function loadProjectRealtimeRecord(
  projectId: string
): Promise<ProjectRealtimeRecord | null> {
  const project = await db.query.projects.findFirst({
    where: eq(projects.id, projectId),
    columns: {
      id: true,
      name: true,
      status: true,
      updatedAt: true,
    },
  });

  if (!project) {
    return null;
  }

  return {
    id: project.id,
    name: project.name,
    status: project.status ?? null,
    updatedAt: project.updatedAt.toISOString(),
  };
}

export async function publishProjectRealtimeSnapshot(projectId: string): Promise<void> {
  const client = getPublisher();
  if (!client) {
    return;
  }

  const project = await loadProjectRealtimeRecord(projectId);
  if (!project) {
    return;
  }

  await client.publish(
    buildProjectRealtimeChannel(projectId),
    JSON.stringify({
      kind: 'project_updated',
      projectId,
      project,
      timestamp: Date.now(),
    } satisfies ProjectUpdatedRealtimeEvent)
  );
}

export async function publishProjectDeletedRealtimeEvent(projectId: string): Promise<void> {
  const client = getPublisher();
  if (!client) {
    return;
  }

  await client.publish(
    buildProjectRealtimeChannel(projectId),
    JSON.stringify({
      kind: 'project_deleted',
      projectId,
      timestamp: Date.now(),
    } satisfies ProjectDeletedRealtimeEvent)
  );
}

export async function createProjectRealtimeSubscriber(input: {
  projectIds: string[];
  onEvent: (event: ProjectRealtimeEvent) => void | Promise<void>;
}): Promise<(() => Promise<void>) | null> {
  if (!isRedisConfigured()) {
    return null;
  }

  const projectIds = [...new Set(input.projectIds.filter(Boolean))];
  if (projectIds.length === 0) {
    return null;
  }

  const subscriber = createRedisClient({
    lazyConnect: true,
    maxRetriesPerRequest: 1,
  });
  const channels = projectIds.map((projectId) => buildProjectRealtimeChannel(projectId));
  const channelSet = new Set(channels);

  const handleMessage = async (receivedChannel: string, payload: string) => {
    if (!channelSet.has(receivedChannel)) {
      return;
    }

    try {
      const parsed = JSON.parse(payload) as ProjectRealtimeEvent;
      await input.onEvent(parsed);
    } catch (error) {
      projectsRealtimeLogger.error('Failed to handle project realtime event', error, {
        channel: receivedChannel,
      });
    }
  };

  subscriber.on('message', handleMessage);
  await subscriber.subscribe(...channels);

  return async () => {
    subscriber.off('message', handleMessage);
    await subscriber.unsubscribe(...channels).catch(() => undefined);
    subscriber.disconnect();
  };
}
