import { describe, expect, it } from 'bun:test';
import {
  getEnvironmentDeploymentRuntime,
  inferEnvironmentDeploymentRuntime,
  usesArgoRolloutsRuntime,
} from '@/lib/environments/model';

describe('environment deployment runtime helpers', () => {
  it('defaults web deployment strategies to argo_rollouts', () => {
    expect(inferEnvironmentDeploymentRuntime('rolling')).toBe('argo_rollouts');
    expect(inferEnvironmentDeploymentRuntime('controlled')).toBe('argo_rollouts');
    expect(inferEnvironmentDeploymentRuntime('canary')).toBe('argo_rollouts');
    expect(inferEnvironmentDeploymentRuntime('blue_green')).toBe('argo_rollouts');
  });

  it('keeps missing strategy on native_k8s by default', () => {
    expect(inferEnvironmentDeploymentRuntime(null)).toBe('native_k8s');
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
