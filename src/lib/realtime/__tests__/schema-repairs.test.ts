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

describe('schema repair realtime events', () => {
  it('disconnects and resets the shared publisher for one-shot runtimes', async () => {
    const { publishSchemaRepairRealtimeEvent, shutdownSchemaRepairRealtimePublisher } =
      await import('@/lib/realtime/schema-repairs');

    const repair = {
      projectId: 'proj_123',
      environmentId: 'env_123',
      id: 'db_123',
      latestAtlasRun: null,
      latestRepairPlan: null,
      schemaState: {
        actualVersion: '202604230001',
        expectedVersion: '202604240001',
        lastInspectedAt: new Date('2026-04-24T04:00:00.000Z'),
        status: 'blocked' as const,
        summary: 'schema blocked',
      },
    };

    await publishSchemaRepairRealtimeEvent({
      projectId: 'proj_123',
      repair,
    });
    await shutdownSchemaRepairRealtimePublisher();
    await publishSchemaRepairRealtimeEvent({
      projectId: 'proj_123',
      repair,
    });
    await shutdownSchemaRepairRealtimePublisher();

    expect((createRedisClientMock.mock?.calls ?? []).length).toBe(2);
    expect((disconnectMock.mock?.calls ?? []).length).toBe(2);
    expect((publishMock.mock?.calls ?? []).length).toBe(2);
  });
});
