import { describe, expect, it } from 'bun:test';
import type * as k8s from '@kubernetes/client-node';
import { buildServiceResource, getPlatformOperationPodTerminalStatus } from '@/lib/k8s';

describe('platform operation job pod terminal status', () => {
  it('treats a succeeded pod as a succeeded operation even before job conditions catch up', () => {
    const pod = {
      status: {
        phase: 'Succeeded',
        containerStatuses: [
          {
            name: 'curl',
            state: {
              terminated: {
                exitCode: 0,
                reason: 'Completed',
              },
            },
          },
        ],
      },
    } as k8s.V1Pod;

    expect(getPlatformOperationPodTerminalStatus(pod)).toBe('succeeded');
  });

  it('treats a terminated non-zero container as a failed operation', () => {
    const pod = {
      status: {
        containerStatuses: [
          {
            name: 'curl',
            state: {
              terminated: {
                exitCode: 28,
                reason: 'Error',
              },
            },
          },
        ],
      },
    } as k8s.V1Pod;

    expect(getPlatformOperationPodTerminalStatus(pod)).toBe('failed');
  });

  it('keeps a non-terminal pod running', () => {
    const pod = {
      status: {
        phase: 'Running',
        containerStatuses: [
          {
            name: 'curl',
            state: {
              running: {},
            },
          },
        ],
      },
    } as k8s.V1Pod;

    expect(getPlatformOperationPodTerminalStatus(pod)).toBe(null);
  });
});

describe('kubernetes service resource builder', () => {
  it('preserves named target ports on initial service creation', () => {
    const service = buildServiceResource({
      namespace: 'juanie',
      name: 'dbgate-cf13',
      spec: {
        port: 80,
        targetPort: 'http',
        selector: { 'juanie.io/console': 'dbgate-cf13' },
        portName: 'http',
      },
    });

    expect(service.metadata?.namespace).toBe('juanie');
    expect(service.spec?.ports?.[0]).toEqual({
      name: 'http',
      port: 80,
      targetPort: 'http',
      protocol: 'TCP',
    });
  });

  it('uses the same port model when replacing existing services', () => {
    const service = buildServiceResource({
      namespace: 'juanie',
      name: 'web',
      current: {
        metadata: {
          resourceVersion: '123',
        },
        spec: {
          type: 'ClusterIP',
          selector: { app: 'old' },
        },
      } as k8s.V1Service,
      spec: {
        port: 80,
        targetPort: 'http',
        selector: { app: 'web' },
        portName: 'http',
      },
    });

    expect(service.metadata?.resourceVersion).toBe('123');
    expect(service.spec?.selector).toEqual({ app: 'web' });
    expect(service.spec?.ports?.[0]?.targetPort).toBe('http');
  });
});
