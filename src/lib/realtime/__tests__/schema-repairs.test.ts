import { describe, expect, it, mock } from 'bun:test';

const publishMock = mock(async () => 1);
const disconnectMock = mock(() => undefined);
const createRedisClientMock = mock(() => ({
  publish: publishMock,
  disconnect: disconnectMock,
}));

mock.module('@/lib/redis/config', () => ({
  createRedisClient: createRedisClientMock,
  isRedisConfigured: () => true,
}));

mock.module('@/lib/db', () => ({
  db: {
    query: {
      databases: {
        findFirst: async () => ({
          id: 'db_123',
          projectId: 'proj_123',
          environmentId: 'env_123',
          schemaState: {
            status: 'blocked',
            summary: 'schema blocked',
            expectedVersion: '202604240001',
            actualVersion: '202604230001',
            lastInspectedAt: new Date('2026-04-24T04:00:00.000Z'),
          },
        }),
      },
      schemaRepairPlans: {
        findFirst: async () => null,
      },
      schemaRepairAtlasRuns: {
        findFirst: async () => null,
      },
    },
  },
}));

describe('schema repair realtime events', () => {
  it('disconnects and resets the shared publisher for one-shot runtimes', async () => {
    const { publishSchemaRepairRealtimeSnapshot, shutdownSchemaRepairRealtimePublisher } =
      await import('@/lib/realtime/schema-repairs');

    await publishSchemaRepairRealtimeSnapshot({
      projectId: 'proj_123',
      databaseId: 'db_123',
    });
    await shutdownSchemaRepairRealtimePublisher();
    await publishSchemaRepairRealtimeSnapshot({
      projectId: 'proj_123',
      databaseId: 'db_123',
    });
    await shutdownSchemaRepairRealtimePublisher();

    expect((createRedisClientMock.mock?.calls ?? []).length).toBe(2);
    expect((disconnectMock.mock?.calls ?? []).length).toBe(2);
    expect((publishMock.mock?.calls ?? []).length).toBe(2);
  });
});
