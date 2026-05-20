import { describe, expect, it } from 'bun:test';
import type * as k8s from '@kubernetes/client-node';
import { getPlatformOperationPodTerminalStatus } from '@/lib/k8s';

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
