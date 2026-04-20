import { describe, expect, it } from 'bun:test';
import {
  getEnvironmentDeploymentRuntime,
  inferEnvironmentDeploymentRuntime,
  usesArgoRolloutsRuntime,
} from '@/lib/environments/model';

describe('environment deployment runtime helpers', () => {
  it('defaults controlled and blue_green strategies to argo_rollouts', () => {
    expect(inferEnvironmentDeploymentRuntime('controlled')).toBe('argo_rollouts');
    expect(inferEnvironmentDeploymentRuntime('blue_green')).toBe('argo_rollouts');
  });

  it('keeps rolling and canary on native_k8s by default', () => {
    expect(inferEnvironmentDeploymentRuntime('rolling')).toBe('native_k8s');
    expect(inferEnvironmentDeploymentRuntime('canary')).toBe('native_k8s');
  });

  it('honors explicitly stored runtime values', () => {
    expect(
      getEnvironmentDeploymentRuntime({
        deploymentStrategy: 'rolling',
        deploymentRuntime: 'argo_rollouts',
      })
    ).toBe('argo_rollouts');
    expect(
      usesArgoRolloutsRuntime({
        deploymentRuntime: 'argo_rollouts',
      })
    ).toBe(true);
  });
});
