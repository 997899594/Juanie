import { describe, expect, it } from 'bun:test';
import {
  buildPromoteArgoRolloutPatch,
  buildScaleArgoRolloutPatch,
  getArgoRolloutReadiness,
} from '@/lib/argocd';
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

  it('uses targeted rollout command patches instead of replacing the rollout spec', () => {
    expect(buildScaleArgoRolloutPatch(2)).toEqual([
      { op: 'add', path: '/spec/replicas', value: 2 },
    ]);
    expect(buildPromoteArgoRolloutPatch({ hasBlueGreenStrategy: true })).toEqual([
      { op: 'add', path: '/spec/paused', value: false },
      { op: 'add', path: '/spec/strategy/blueGreen/autoPromotionEnabled', value: true },
    ]);
    expect(buildPromoteArgoRolloutPatch({ hasBlueGreenStrategy: false })).toEqual([
      { op: 'add', path: '/spec/paused', value: false },
    ]);
  });

  it('does not treat degraded or invalid rollouts as ready', () => {
    expect(
      getArgoRolloutReadiness({
        metadata: { generation: 3 },
        spec: { replicas: 1 },
        status: {
          phase: 'Degraded',
          observedGeneration: 3,
          updatedReplicas: 1,
          availableReplicas: 1,
        },
      })
    ).toEqual({ ready: false, state: 'degraded' });

    expect(
      getArgoRolloutReadiness({
        metadata: { generation: 3 },
        spec: { replicas: 1 },
        status: {
          phase: 'Healthy',
          observedGeneration: 3,
          updatedReplicas: 1,
          availableReplicas: 1,
          conditions: [{ type: 'InvalidSpec', status: 'True', reason: 'InvalidSpec' }],
        },
      })
    ).toEqual({ ready: false, state: 'degraded' });

    expect(
      getArgoRolloutReadiness({
        metadata: { generation: 3 },
        spec: { replicas: 1 },
        status: {
          phase: 'Healthy',
          observedGeneration: 3,
          updatedReplicas: 1,
          availableReplicas: 1,
        },
      })
    ).toEqual({ ready: true, state: 'healthy' });
  });
});
