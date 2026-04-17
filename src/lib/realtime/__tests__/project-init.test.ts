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

describe('project init realtime events', () => {
  it('builds a stable project init channel name', async () => {
    const { buildProjectInitChannel } = await import('@/lib/realtime/project-init');

    expect(buildProjectInitChannel('proj_123')).toBe('realtime:project-init:proj_123');
  });

  it('publishes step updates onto the project-specific channel', async () => {
    const { publishProjectInitRealtimeEvent } = await import('@/lib/realtime/project-init');

    await publishProjectInitRealtimeEvent({
      kind: 'step_updated',
      projectId: 'proj_123',
      step: 'push_cicd_config',
      status: 'running',
      progress: 80,
      timestamp: 123,
    });

    expect((publishMock.mock?.calls ?? []).length >= 1).toBe(true);
    expect(publishMock).toHaveBeenCalledWith(
      'realtime:project-init:proj_123',
      JSON.stringify({
        kind: 'step_updated',
        projectId: 'proj_123',
        step: 'push_cicd_config',
        status: 'running',
        progress: 80,
        timestamp: 123,
      })
    );
  });

  it('subscribes to the project-specific channel and relays parsed events', async () => {
    const { createProjectInitRealtimeSubscriber } = await import('@/lib/realtime/project-init');
    const onEvent = mock(async () => undefined);

    const unsubscribe = await createProjectInitRealtimeSubscriber({
      projectId: 'proj_456',
      onEvent,
    });

    expect(subscribeMock).toHaveBeenCalledWith('realtime:project-init:proj_456');
    expect(Boolean(messageHandler)).toBe(true);

    await messageHandler?.(
      'realtime:project-init:proj_456',
      JSON.stringify({
        kind: 'step_updated',
        projectId: 'proj_456',
        step: 'configure_dns',
        status: 'completed',
        progress: 100,
        timestamp: 456,
      })
    );

    expect(onEvent).toHaveBeenCalledWith({
      kind: 'step_updated',
      projectId: 'proj_456',
      step: 'configure_dns',
      status: 'completed',
      progress: 100,
      timestamp: 456,
    });

    await unsubscribe?.();

    expect(unsubscribeMock).toHaveBeenCalledWith('realtime:project-init:proj_456');
    expect((disconnectMock.mock?.calls ?? []).length >= 1).toBe(true);
  });
});
