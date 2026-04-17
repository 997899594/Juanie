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

describe('deployment realtime events', () => {
  it('builds stable deployment channels', async () => {
    const { buildDeploymentRealtimeChannel, buildDeploymentLogRealtimeChannel } = await import(
      '@/lib/realtime/deployments'
    );

    expect(buildDeploymentRealtimeChannel('proj_123')).toBe(
      'realtime:deployments:project:proj_123'
    );
    expect(buildDeploymentLogRealtimeChannel('dep_123')).toBe(
      'realtime:deployment-logs:deployment:dep_123'
    );
  });

  it('subscribes to deployment summary updates and relays parsed events', async () => {
    const { createDeploymentRealtimeSubscriber } = await import('@/lib/realtime/deployments');
    const onEvent = mock(async () => undefined);

    const unsubscribe = await createDeploymentRealtimeSubscriber({
      projectId: 'proj_456',
      onEvent,
    });

    expect(subscribeMock).toHaveBeenCalledWith('realtime:deployments:project:proj_456');

    await messageHandler?.(
      'realtime:deployments:project:proj_456',
      JSON.stringify({
        kind: 'deployment_updated',
        projectId: 'proj_456',
        deployment: {
          id: 'dep_456',
          projectId: 'proj_456',
          status: 'queued',
          version: 'v2',
          commitSha: 'def456',
          environmentId: 'env_2',
          serviceId: 'svc_2',
          createdAt: '2026-04-17T11:00:00.000Z',
          deployedAt: null,
          environmentName: 'preview',
          serviceName: 'worker',
        },
        timestamp: 456,
      })
    );

    expect(onEvent).toHaveBeenCalledWith({
      kind: 'deployment_updated',
      projectId: 'proj_456',
      deployment: {
        id: 'dep_456',
        projectId: 'proj_456',
        status: 'queued',
        version: 'v2',
        commitSha: 'def456',
        environmentId: 'env_2',
        serviceId: 'svc_2',
        createdAt: '2026-04-17T11:00:00.000Z',
        deployedAt: null,
        environmentName: 'preview',
        serviceName: 'worker',
      },
      timestamp: 456,
    });

    await unsubscribe?.();

    expect(unsubscribeMock).toHaveBeenCalledWith('realtime:deployments:project:proj_456');
    expect((disconnectMock.mock?.calls ?? []).length >= 1).toBe(true);
  });

  it('subscribes to deployment log updates and relays parsed events', async () => {
    const { createDeploymentLogRealtimeSubscriber } = await import('@/lib/realtime/deployments');
    const onEvent = mock(async () => undefined);

    const unsubscribe = await createDeploymentLogRealtimeSubscriber({
      deploymentId: 'dep_456',
      onEvent,
    });

    expect(subscribeMock).toHaveBeenCalledWith('realtime:deployment-logs:deployment:dep_456');

    await messageHandler?.(
      'realtime:deployment-logs:deployment:dep_456',
      JSON.stringify({
        kind: 'deployment_log_appended',
        deploymentId: 'dep_456',
        log: {
          id: 'log_456',
          deploymentId: 'dep_456',
          level: 'warn',
          message: 'careful',
          createdAt: '2026-04-17T11:00:00.000Z',
        },
        timestamp: 456,
      })
    );

    expect(onEvent).toHaveBeenCalledWith({
      kind: 'deployment_log_appended',
      deploymentId: 'dep_456',
      log: {
        id: 'log_456',
        deploymentId: 'dep_456',
        level: 'warn',
        message: 'careful',
        createdAt: '2026-04-17T11:00:00.000Z',
      },
      timestamp: 456,
    });

    await unsubscribe?.();

    expect(unsubscribeMock).toHaveBeenCalledWith('realtime:deployment-logs:deployment:dep_456');
    expect((disconnectMock.mock?.calls ?? []).length >= 1).toBe(true);
  });
});
