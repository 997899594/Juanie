import { describe, expect, it } from 'bun:test';
import {
  requiresManualArgoRolloutPromotion,
  shouldUseArgoRolloutsForService,
  supportsArgoRolloutsDeploymentStrategy,
} from '@/lib/releases/argo-rollouts';

describe('Argo Rollouts workload routing', () => {
  it('supports every web deployment strategy', () => {
    expect(supportsArgoRolloutsDeploymentStrategy('rolling')).toBe(true);
    expect(supportsArgoRolloutsDeploymentStrategy('controlled')).toBe(true);
    expect(supportsArgoRolloutsDeploymentStrategy('canary')).toBe(true);
    expect(supportsArgoRolloutsDeploymentStrategy('blue_green')).toBe(true);
  });

  it('uses Argo Rollouts only for public web services with blocking checks', () => {
    expect(
      shouldUseArgoRolloutsForService({
        strategy: 'rolling',
        service: { type: 'web', isPublic: true },
        hasBlockingVerification: true,
      })
    ).toBe(true);
    expect(
      shouldUseArgoRolloutsForService({
        strategy: 'controlled',
        service: { type: 'worker', isPublic: false },
        hasBlockingVerification: true,
      })
    ).toBe(false);
    expect(
      shouldUseArgoRolloutsForService({
        strategy: 'controlled',
        service: { type: 'web', isPublic: false },
        hasBlockingVerification: true,
      })
    ).toBe(false);
    expect(
      shouldUseArgoRolloutsForService({
        strategy: 'controlled',
        service: { type: 'web', isPublic: true },
        hasBlockingVerification: false,
      })
    ).toBe(false);
  });

  it('keeps manual promotion scoped to controlled and blue-green releases', () => {
    expect(requiresManualArgoRolloutPromotion('rolling')).toBe(false);
    expect(requiresManualArgoRolloutPromotion('canary')).toBe(false);
    expect(requiresManualArgoRolloutPromotion('controlled')).toBe(true);
    expect(requiresManualArgoRolloutPromotion('blue_green')).toBe(true);
  });
});
