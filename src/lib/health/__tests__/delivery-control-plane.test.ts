import { describe, expect, it } from 'bun:test';
import {
  type DeliveryControlPlaneSnapshot,
  resolveDeliveryControlPlaneHealth,
} from '@/lib/health/delivery-control-plane';

const now = new Date('2026-07-24T12:00:00.000Z');
const healthy: DeliveryControlPlaneSnapshot = {
  deadLetters: 0,
  stuckExecutions: 0,
  stuckBuilds: 0,
  stuckReleases: 0,
  webhookDrift: 0,
  latestCanary: {
    status: 'production_verified',
    createdAt: new Date('2026-07-24T10:00:00.000Z'),
    completedAt: new Date('2026-07-24T10:01:00.000Z'),
  },
};

describe('delivery control-plane health projection', () => {
  it('fails for authoritative delivery work that is lost or stuck', () => {
    expect(resolveDeliveryControlPlaneHealth({ ...healthy, deadLetters: 1 }, now).status).toBe(
      'fail'
    );
    expect(resolveDeliveryControlPlaneHealth({ ...healthy, stuckExecutions: 1 }, now).status).toBe(
      'fail'
    );
  });

  it('fails when the real-chain canary is unsuccessful or expired', () => {
    expect(
      resolveDeliveryControlPlaneHealth(
        { ...healthy, latestCanary: { ...healthy.latestCanary!, status: 'failed' } },
        now
      ).status
    ).toBe('fail');
    expect(
      resolveDeliveryControlPlaneHealth(
        {
          ...healthy,
          latestCanary: {
            ...healthy.latestCanary!,
            createdAt: new Date('2026-07-24T03:59:00.000Z'),
          },
        },
        now
      ).status
    ).toBe('fail');
  });

  it('degrades for controller drift and passes only after full convergence', () => {
    expect(resolveDeliveryControlPlaneHealth({ ...healthy, webhookDrift: 1 }, now).status).toBe(
      'warn'
    );
    expect(resolveDeliveryControlPlaneHealth(healthy, now).status).toBe('pass');
  });
});
