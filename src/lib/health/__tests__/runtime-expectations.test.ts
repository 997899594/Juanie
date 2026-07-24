import { describe, expect, it } from 'bun:test';
import { resolveServiceRuntimeExpectation } from '@/lib/health/runtime-expectations';

describe('service runtime expectations', () => {
  it('marks an intentionally sleeping service as not applicable', () => {
    expect(
      resolveServiceRuntimeExpectation({
        workloadObserved: true,
        desiredReplicas: 0,
        readyReplicas: 0,
      }).status
    ).toBe('not_applicable');
  });

  it('requires readiness only when the platform expects replicas', () => {
    expect(
      resolveServiceRuntimeExpectation({
        workloadObserved: true,
        desiredReplicas: 1,
        readyReplicas: 0,
      }).status
    ).toBe('fail');
    expect(
      resolveServiceRuntimeExpectation({
        workloadObserved: true,
        desiredReplicas: 1,
        readyReplicas: 1,
      }).status
    ).toBe('pass');
  });
});
