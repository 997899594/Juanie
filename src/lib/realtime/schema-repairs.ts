import { and, desc, eq } from 'drizzle-orm';
import type Redis from 'ioredis';
import { db } from '@/lib/db';
import { databases, schemaRepairAtlasRuns, schemaRepairPlans } from '@/lib/db/schema';
import { logger } from '@/lib/logger';
import { createRedisClient, isRedisConfigured } from '@/lib/redis/config';
import {
  type SchemaRepairRealtimeEvent,
  type SchemaRepairRealtimeRecord,
} from '@/lib/schema-management/realtime';

const SCHEMA_REPAIR_CHANNEL_PREFIX = 'realtime:schema-repairs:project:';
const schemaRepairsRealtimeLogger = logger.child({ component: 'realtime-schema-repairs' });

let publisher: Redis | null = null;

export function buildSchemaRepairRealtimeChannel(projectId: string): string {
  return `${SCHEMA_REPAIR_CHANNEL_PREFIX}${projectId}`;
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

export async function shutdownSchemaRepairRealtimePublisher(): Promise<void> {
  if (!publisher) {
    return;
  }

  publisher.disconnect();
  publisher = null;
}

function buildDatabaseWhere(projectId: string, environmentId?: string | null) {
  return environmentId
    ? and(eq(databases.projectId, projectId), eq(databases.environmentId, environmentId))
    : eq(databases.projectId, projectId);
}

function buildPlanWhere(projectId: string, environmentId?: string | null) {
  return environmentId
    ? and(
        eq(schemaRepairPlans.projectId, projectId),
        eq(schemaRepairPlans.environmentId, environmentId)
      )
    : eq(schemaRepairPlans.projectId, projectId);
}

function buildAtlasRunWhere(projectId: string, environmentId?: string | null) {
  return environmentId
    ? and(
        eq(schemaRepairAtlasRuns.projectId, projectId),
        eq(schemaRepairAtlasRuns.environmentId, environmentId)
      )
    : eq(schemaRepairAtlasRuns.projectId, projectId);
}

export async function loadSchemaRepairRealtimeRecord(input: {
  projectId: string;
  databaseId: string;
}): Promise<SchemaRepairRealtimeRecord | null> {
  const [database, latestPlan, latestAtlasRun] = await Promise.all([
    db.query.databases.findFirst({
      where: and(eq(databases.id, input.databaseId), eq(databases.projectId, input.projectId)),
      columns: {
        id: true,
        projectId: true,
        environmentId: true,
      },
      with: {
        schemaState: {
          columns: {
            status: true,
            summary: true,
            expectedVersion: true,
            actualVersion: true,
            lastInspectedAt: true,
          },
        },
      },
    }),
    db.query.schemaRepairPlans.findFirst({
      where: and(
        eq(schemaRepairPlans.projectId, input.projectId),
        eq(schemaRepairPlans.databaseId, input.databaseId)
      ),
      columns: {
        id: true,
        kind: true,
        status: true,
        reviewState: true,
        atlasExecutionStatus: true,
        atlasExecutionStartedAt: true,
        atlasExecutionFinishedAt: true,
        errorMessage: true,
      },
      orderBy: [desc(schemaRepairPlans.createdAt)],
    }),
    db.query.schemaRepairAtlasRuns.findFirst({
      where: and(
        eq(schemaRepairAtlasRuns.projectId, input.projectId),
        eq(schemaRepairAtlasRuns.databaseId, input.databaseId)
      ),
      columns: {
        id: true,
        status: true,
        startedAt: true,
        finishedAt: true,
      },
      orderBy: [desc(schemaRepairAtlasRuns.createdAt)],
    }),
  ]);

  if (!database?.environmentId) {
    return null;
  }

  return {
    id: database.id,
    projectId: database.projectId,
    environmentId: database.environmentId,
    schemaState: database.schemaState
      ? {
          status: database.schemaState.status,
          summary: database.schemaState.summary,
          expectedVersion: database.schemaState.expectedVersion,
          actualVersion: database.schemaState.actualVersion,
          lastInspectedAt: database.schemaState.lastInspectedAt,
        }
      : null,
    latestRepairPlan: latestPlan
      ? {
          id: latestPlan.id,
          kind: latestPlan.kind,
          status: latestPlan.status,
          reviewState: latestPlan.reviewState ?? 'unknown',
          atlasExecutionStatus: latestPlan.atlasExecutionStatus ?? 'idle',
          atlasExecutionStartedAt: latestPlan.atlasExecutionStartedAt,
          atlasExecutionFinishedAt: latestPlan.atlasExecutionFinishedAt,
          errorMessage: latestPlan.errorMessage,
        }
      : null,
    latestAtlasRun: latestAtlasRun
      ? {
          id: latestAtlasRun.id,
          status: latestAtlasRun.status,
          startedAt: latestAtlasRun.startedAt,
          finishedAt: latestAtlasRun.finishedAt,
        }
      : null,
  };
}

export async function loadProjectSchemaRepairRealtimeRecords(input: {
  projectId: string;
  environmentId?: string | null;
}): Promise<SchemaRepairRealtimeRecord[]> {
  const [projectDatabases, plans, atlasRuns] = await Promise.all([
    db.query.databases.findMany({
      where: buildDatabaseWhere(input.projectId, input.environmentId),
      columns: {
        id: true,
        projectId: true,
        environmentId: true,
      },
      with: {
        schemaState: {
          columns: {
            status: true,
            summary: true,
            expectedVersion: true,
            actualVersion: true,
            lastInspectedAt: true,
          },
        },
      },
      orderBy: [databases.createdAt],
    }),
    db.query.schemaRepairPlans.findMany({
      where: buildPlanWhere(input.projectId, input.environmentId),
      columns: {
        id: true,
        databaseId: true,
        kind: true,
        status: true,
        reviewState: true,
        atlasExecutionStatus: true,
        atlasExecutionStartedAt: true,
        atlasExecutionFinishedAt: true,
        errorMessage: true,
      },
      orderBy: [desc(schemaRepairPlans.createdAt)],
    }),
    db.query.schemaRepairAtlasRuns.findMany({
      where: buildAtlasRunWhere(input.projectId, input.environmentId),
      columns: {
        id: true,
        databaseId: true,
        status: true,
        startedAt: true,
        finishedAt: true,
      },
      orderBy: [desc(schemaRepairAtlasRuns.createdAt)],
    }),
  ]);

  const latestPlanByDatabaseId = new Map<string, (typeof plans)[number]>();
  for (const plan of plans) {
    if (!latestPlanByDatabaseId.has(plan.databaseId)) {
      latestPlanByDatabaseId.set(plan.databaseId, plan);
    }
  }

  const latestAtlasRunByDatabaseId = new Map<string, (typeof atlasRuns)[number]>();
  for (const run of atlasRuns) {
    if (!latestAtlasRunByDatabaseId.has(run.databaseId)) {
      latestAtlasRunByDatabaseId.set(run.databaseId, run);
    }
  }

  return projectDatabases
    .filter((database) => Boolean(database.environmentId))
    .map((database) => {
      const latestPlan = latestPlanByDatabaseId.get(database.id) ?? null;
      const latestAtlasRun = latestAtlasRunByDatabaseId.get(database.id) ?? null;

      return {
        id: database.id,
        projectId: database.projectId,
        environmentId: database.environmentId as string,
        schemaState: database.schemaState
          ? {
              status: database.schemaState.status,
              summary: database.schemaState.summary,
              expectedVersion: database.schemaState.expectedVersion,
              actualVersion: database.schemaState.actualVersion,
              lastInspectedAt: database.schemaState.lastInspectedAt,
            }
          : null,
        latestRepairPlan: latestPlan
          ? {
              id: latestPlan.id,
              kind: latestPlan.kind,
              status: latestPlan.status,
              reviewState: latestPlan.reviewState ?? 'unknown',
              atlasExecutionStatus: latestPlan.atlasExecutionStatus ?? 'idle',
              atlasExecutionStartedAt: latestPlan.atlasExecutionStartedAt,
              atlasExecutionFinishedAt: latestPlan.atlasExecutionFinishedAt,
              errorMessage: latestPlan.errorMessage,
            }
          : null,
        latestAtlasRun: latestAtlasRun
          ? {
              id: latestAtlasRun.id,
              status: latestAtlasRun.status,
              startedAt: latestAtlasRun.startedAt,
              finishedAt: latestAtlasRun.finishedAt,
            }
          : null,
      };
    });
}

export async function publishSchemaRepairRealtimeSnapshot(input: {
  projectId: string;
  databaseId: string;
}): Promise<void> {
  const client = getPublisher();
  const repair = await loadSchemaRepairRealtimeRecord(input);

  if (!client || !repair) {
    return;
  }

  await client.publish(
    buildSchemaRepairRealtimeChannel(input.projectId),
    JSON.stringify({
      kind: 'schema_repair_updated',
      projectId: input.projectId,
      repair,
      timestamp: Date.now(),
    } satisfies SchemaRepairRealtimeEvent)
  );
}

export async function createSchemaRepairRealtimeSubscriber(input: {
  projectId: string;
  onEvent: (event: SchemaRepairRealtimeEvent) => void | Promise<void>;
}): Promise<(() => Promise<void>) | null> {
  if (!isRedisConfigured()) {
    return null;
  }

  const subscriber = createRedisClient({
    lazyConnect: true,
    maxRetriesPerRequest: 1,
  });
  const channel = buildSchemaRepairRealtimeChannel(input.projectId);

  const handleMessage = async (receivedChannel: string, payload: string) => {
    if (receivedChannel !== channel) {
      return;
    }

    try {
      const parsed = JSON.parse(payload) as SchemaRepairRealtimeEvent;
      await input.onEvent(parsed);
    } catch (error) {
      schemaRepairsRealtimeLogger.error('Failed to handle schema repair realtime event', error, {
        channel: receivedChannel,
      });
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
