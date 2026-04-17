import type Redis from 'ioredis';
import { createRedisClient, isRedisConfigured } from '@/lib/redis/config';

const PROJECT_INIT_CHANNEL_PREFIX = 'realtime:project-init:';

export interface ProjectInitRealtimeEvent {
  kind: 'step_updated';
  projectId: string;
  step: string;
  status: string;
  progress: number | null;
  timestamp: number;
}

let publisher: Redis | null = null;

export function buildProjectInitChannel(projectId: string): string {
  return `${PROJECT_INIT_CHANNEL_PREFIX}${projectId}`;
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

export async function publishProjectInitRealtimeEvent(
  event: ProjectInitRealtimeEvent
): Promise<void> {
  const client = getPublisher();
  if (!client) {
    return;
  }

  await client.publish(buildProjectInitChannel(event.projectId), JSON.stringify(event));
}

export async function createProjectInitRealtimeSubscriber(input: {
  projectId: string;
  onEvent: (event: ProjectInitRealtimeEvent) => void | Promise<void>;
}): Promise<(() => Promise<void>) | null> {
  if (!isRedisConfigured()) {
    return null;
  }

  const subscriber = createRedisClient({
    lazyConnect: true,
    maxRetriesPerRequest: 1,
  });
  const channel = buildProjectInitChannel(input.projectId);

  const handleMessage = async (receivedChannel: string, payload: string) => {
    if (receivedChannel !== channel) {
      return;
    }

    try {
      const parsed = JSON.parse(payload) as ProjectInitRealtimeEvent;
      await input.onEvent(parsed);
    } catch (error) {
      console.error('Failed to handle project init realtime event:', error);
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
