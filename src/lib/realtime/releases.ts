import { desc, eq } from 'drizzle-orm';
import type Redis from 'ioredis';
import { db } from '@/lib/db';
import { releases } from '@/lib/db/schema';
import { createRedisClient, isRedisConfigured } from '@/lib/redis/config';

const RELEASE_CHANNEL_PREFIX = 'realtime:releases:project:';

export interface ReleaseRealtimeRecord {
  id: string;
  status: string;
  sourceCommitSha: string | null;
  sourceRef: string;
  createdAt: string;
  updatedAt: string;
  summary: string | null;
  recap: {
    generatedAt?: string | null;
  } | null;
  environment: {
    id: string;
    name: string;
  };
  artifacts: Array<{
    id: string;
    imageUrl: string;
    service: {
      id: string;
      name: string;
    };
  }>;
}

export interface ReleaseRealtimeEvent {
  kind: 'release_updated';
  projectId: string;
  release: ReleaseRealtimeRecord;
  timestamp: number;
}

let publisher: Redis | null = null;

export function buildReleaseRealtimeChannel(projectId: string): string {
  return `${RELEASE_CHANNEL_PREFIX}${projectId}`;
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

export async function loadReleaseRealtimeRecord(releaseId: string): Promise<{
  projectId: string;
  release: ReleaseRealtimeRecord;
} | null> {
  const release = await db.query.releases.findFirst({
    where: eq(releases.id, releaseId),
    columns: {
      id: true,
      projectId: true,
      status: true,
      sourceCommitSha: true,
      sourceRef: true,
      createdAt: true,
      updatedAt: true,
      summary: true,
      recap: true,
    },
    with: {
      environment: {
        columns: {
          id: true,
          name: true,
        },
      },
      artifacts: {
        columns: {
          id: true,
          imageUrl: true,
        },
        with: {
          service: {
            columns: {
              id: true,
              name: true,
            },
          },
        },
      },
    },
  });

  if (!release) {
    return null;
  }

  return {
    projectId: release.projectId,
    release: {
      id: release.id,
      status: release.status,
      sourceCommitSha: release.sourceCommitSha ?? null,
      sourceRef: release.sourceRef,
      createdAt: release.createdAt.toISOString(),
      updatedAt: release.updatedAt.toISOString(),
      summary: release.summary ?? null,
      recap:
        release.recap && typeof release.recap === 'object'
          ? ((release.recap as { generatedAt?: string | null }) ?? null)
          : null,
      environment: {
        id: release.environment.id,
        name: release.environment.name,
      },
      artifacts: release.artifacts.map((artifact) => ({
        id: artifact.id,
        imageUrl: artifact.imageUrl,
        service: {
          id: artifact.service.id,
          name: artifact.service.name,
        },
      })),
    },
  };
}

export async function loadLatestProjectReleaseRealtimeRecord(projectId: string): Promise<{
  projectId: string;
  release: ReleaseRealtimeRecord;
} | null> {
  const latestRelease = await db.query.releases.findFirst({
    where: eq(releases.projectId, projectId),
    columns: {
      id: true,
    },
    orderBy: [desc(releases.createdAt)],
  });

  if (!latestRelease) {
    return null;
  }

  return loadReleaseRealtimeRecord(latestRelease.id);
}

export async function publishReleaseRealtimeSnapshot(releaseId: string): Promise<void> {
  const client = getPublisher();
  if (!client) {
    return;
  }

  const payload = await loadReleaseRealtimeRecord(releaseId);
  if (!payload) {
    return;
  }

  await client.publish(
    buildReleaseRealtimeChannel(payload.projectId),
    JSON.stringify({
      kind: 'release_updated',
      projectId: payload.projectId,
      release: payload.release,
      timestamp: Date.now(),
    } satisfies ReleaseRealtimeEvent)
  );
}

export async function publishReleaseRealtimeSnapshots(releaseIds: string[]): Promise<void> {
  await Promise.all(releaseIds.map((releaseId) => publishReleaseRealtimeSnapshot(releaseId)));
}

export async function createReleaseRealtimeSubscriber(input: {
  projectId: string;
  onEvent: (event: ReleaseRealtimeEvent) => void | Promise<void>;
}): Promise<(() => Promise<void>) | null> {
  if (!isRedisConfigured()) {
    return null;
  }

  const subscriber = createRedisClient({
    lazyConnect: true,
    maxRetriesPerRequest: 1,
  });
  const channel = buildReleaseRealtimeChannel(input.projectId);

  const handleMessage = async (receivedChannel: string, payload: string) => {
    if (receivedChannel !== channel) {
      return;
    }

    try {
      const parsed = JSON.parse(payload) as ReleaseRealtimeEvent;
      await input.onEvent(parsed);
    } catch (error) {
      console.error('Failed to handle release realtime event:', error);
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
