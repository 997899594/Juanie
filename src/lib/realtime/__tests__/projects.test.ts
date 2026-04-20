import { describe, expect, it, mock } from 'bun:test';

const publishMock = mock(async () => 1);
const subscribeMock = mock(async () => 1);
const unsubscribeMock = mock(async () => 1);
const disconnectMock = mock(() => undefined);
let messageHandler: ((channel: string, payload: string) => void | Promise<void>) | null = null;

const createRedisClientMock = mock(() => {
  const on = mock((event: string, handler: typeof messageHandler) => {
    if (event === 'message') {
      messageHandler = handler;
    }
  });
  const off = mock((event: string) => {
    if (event === 'message') {
      messageHandler = null;
    }
  });

  return {
    publish: publishMock,
    subscribe: subscribeMock,
    unsubscribe: unsubscribeMock,
    disconnect: disconnectMock,
    on,
    off,
  };
});

mock.module('@/lib/redis/config', () => ({
  createRedisClient: createRedisClientMock,
  isRedisConfigured: () => true,
}));

describe('project realtime events', () => {
  it('builds stable project channel names', async () => {
    const { buildProjectRealtimeChannel } = await import('@/lib/realtime/projects');

    expect(buildProjectRealtimeChannel('proj_123')).toBe('realtime:projects:project:proj_123');
  });

  it('subscribes to multiple project channels and relays update payloads', async () => {
    const { createProjectRealtimeSubscriber } = await import('@/lib/realtime/projects');
    const onEvent = mock(async () => undefined);

    const unsubscribe = await createProjectRealtimeSubscriber({
      projectIds: ['proj_123', 'proj_456'],
      onEvent,
    });

    expect(subscribeMock).toHaveBeenCalledWith(
      'realtime:projects:project:proj_123',
      'realtime:projects:project:proj_456'
    );

    await messageHandler?.(
      'realtime:projects:project:proj_456',
      JSON.stringify({
        kind: 'project_updated',
        projectId: 'proj_456',
        project: {
          id: 'proj_456',
          name: 'NexusNote',
          status: 'deleting',
          updatedAt: '2026-04-20T09:00:00.000Z',
        },
        timestamp: 456,
      })
    );

    expect(onEvent).toHaveBeenCalledWith({
      kind: 'project_updated',
      projectId: 'proj_456',
      project: {
        id: 'proj_456',
        name: 'NexusNote',
        status: 'deleting',
        updatedAt: '2026-04-20T09:00:00.000Z',
      },
      timestamp: 456,
    });

    await unsubscribe?.();

    expect(unsubscribeMock).toHaveBeenCalledWith(
      'realtime:projects:project:proj_123',
      'realtime:projects:project:proj_456'
    );
    expect((disconnectMock.mock?.calls ?? []).length >= 1).toBe(true);
  });

  it('relays project deleted payloads', async () => {
    const { createProjectRealtimeSubscriber } = await import('@/lib/realtime/projects');
    const onEvent = mock(async () => undefined);

    await createProjectRealtimeSubscriber({
      projectIds: ['proj_789'],
      onEvent,
    });

    await messageHandler?.(
      'realtime:projects:project:proj_789',
      JSON.stringify({
        kind: 'project_deleted',
        projectId: 'proj_789',
        timestamp: 789,
      })
    );

    expect(onEvent).toHaveBeenCalledWith({
      kind: 'project_deleted',
      projectId: 'proj_789',
      timestamp: 789,
    });
  });
});
