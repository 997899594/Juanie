import { describe, expect, it } from 'bun:test';
import {
  createKubernetesNotApplicableCheck,
  deriveFullHealthStatus,
} from '@/lib/health/dependency-checks';

describe('dependency health policy', () => {
  it('represents unassigned Kubernetes access without a warning or failure', () => {
    expect(createKubernetesNotApplicableCheck()).toEqual({
      status: 'not_applicable',
      message: 'Kubernetes access is not assigned to this runtime',
    });
  });

  it('fails full health when application delivery is unavailable', () => {
    expect(
      deriveFullHealthStatus({
        database: { status: 'pass' },
        restate: { status: 'pass' },
        applicationDelivery: { status: 'fail' },
      })
    ).toBe('unhealthy');
  });

  it('keeps rebuildable dependencies degraded instead of failing required health', () => {
    expect(
      deriveFullHealthStatus({
        database: { status: 'pass' },
        redis: { status: 'fail' },
        restate: { status: 'pass' },
        applicationDelivery: { status: 'pass' },
        kubernetes: createKubernetesNotApplicableCheck(),
      })
    ).toBe('degraded');
  });

  it('fails full health when the durable delivery chain is broken', () => {
    expect(
      deriveFullHealthStatus({
        database: { status: 'pass' },
        restate: { status: 'pass' },
        applicationDelivery: { status: 'pass' },
        deliveryControlPlane: { status: 'fail' },
      })
    ).toBe('unhealthy');
  });

  it('reports controller drift as degraded', () => {
    expect(
      deriveFullHealthStatus({
        database: { status: 'pass' },
        restate: { status: 'pass' },
        applicationDelivery: { status: 'pass' },
        deliveryControlPlane: { status: 'warn' },
      })
    ).toBe('degraded');
  });
});
