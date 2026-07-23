import { describe, expect, it } from 'bun:test';
import { planPlatformRelease, restateOperatorLockPath } from '../plan-platform-release';

describe('platform release planner', () => {
  it('does not deploy workflow and documentation-only changes', () => {
    const plan = planPlatformRelease(['.github/workflows/ci.yml', 'docs/operations.md'], []);

    expect(plan.platformRequired).toBe(false);
    expect(plan.operatorRequired).toBe(false);
  });

  it('deploys the platform when component images changed', () => {
    const plan = planPlatformRelease(['src/app/page.tsx'], ['web']);

    expect(plan.platformRequired).toBe(true);
    expect(plan.operatorRequired).toBe(false);
  });

  it('deploys the platform for chart-only changes', () => {
    const plan = planPlatformRelease(['deploy/k8s/charts/juanie/templates/deployment.yaml'], []);

    expect(plan.platformRequired).toBe(true);
    expect(plan.operatorRequired).toBe(false);
  });

  it('deploys a new immutable application delivery workflow revision', () => {
    const plan = planPlatformRelease(['.github/workflows/application-delivery.yml'], []);

    expect(plan.platformRequired).toBe(true);
    expect(plan.operatorRequired).toBe(false);
  });

  it('reconciles only the operator when its lock changes', () => {
    const plan = planPlatformRelease([restateOperatorLockPath], []);

    expect(plan.platformRequired).toBe(false);
    expect(plan.operatorRequired).toBe(true);
  });

  it('converges every production component without a successful deployment baseline', () => {
    const plan = planPlatformRelease(null, []);

    expect(plan.platformRequired).toBe(true);
    expect(plan.operatorRequired).toBe(true);
  });
});
