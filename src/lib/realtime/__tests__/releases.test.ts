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

describe('release realtime events', () => {
  it('builds stable release channel names', async () => {
    const { buildReleaseRealtimeChannel } = await import('@/lib/realtime/releases');

    expect(buildReleaseRealtimeChannel('proj_123')).toBe('realtime:releases:project:proj_123');
  });

  it('subscribes to release updates and relays parsed payloads', async () => {
    const { createReleaseRealtimeSubscriber } = await import('@/lib/realtime/releases');
    const onEvent = mock(async () => undefined);

    const unsubscribe = await createReleaseRealtimeSubscriber({
      projectId: 'proj_456',
      onEvent,
    });

    expect(subscribeMock).toHaveBeenCalledWith('realtime:releases:project:proj_456');

    await messageHandler?.(
      'realtime:releases:project:proj_456',
      JSON.stringify({
        kind: 'release_updated',
        projectId: 'proj_456',
        release: {
          id: 'rel_456',
          status: 'queued',
          sourceCommitSha: null,
          sourceRef: 'feature/x',
          createdAt: '2026-04-17T11:00:00.000Z',
          updatedAt: '2026-04-17T11:00:00.000Z',
          summary: null,
          recap: null,
          environment: {
            id: 'env_2',
            name: 'preview',
          },
          artifacts: [],
        },
        timestamp: 456,
      })
    );

    expect(onEvent).toHaveBeenCalledWith({
      kind: 'release_updated',
      projectId: 'proj_456',
      release: {
        id: 'rel_456',
        status: 'queued',
        sourceCommitSha: null,
        sourceRef: 'feature/x',
        createdAt: '2026-04-17T11:00:00.000Z',
        updatedAt: '2026-04-17T11:00:00.000Z',
        summary: null,
        recap: null,
        environment: {
          id: 'env_2',
          name: 'preview',
        },
        artifacts: [],
      },
      timestamp: 456,
    });

    await unsubscribe?.();

    expect(unsubscribeMock).toHaveBeenCalledWith('realtime:releases:project:proj_456');
    expect((disconnectMock.mock?.calls ?? []).length >= 1).toBe(true);
  });
});
