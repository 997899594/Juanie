import { describe, expect, it } from 'bun:test';
import { createKubernetesNotApplicableCheck } from '@/lib/health/dependency-checks';

describe('dependency health policy', () => {
  it('represents unassigned Kubernetes access without a warning or failure', () => {
    expect(createKubernetesNotApplicableCheck()).toEqual({
      status: 'not_applicable',
      message: 'Kubernetes access is not assigned to this runtime',
    });
  });
});
