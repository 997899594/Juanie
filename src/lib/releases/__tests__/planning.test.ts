import { describe, expect, it } from 'bun:test';
import { summarizeReleasePlan } from '@/lib/releases/planning';

describe('release planning', () => {
  it('summarizes approval-gated production plans', () => {
    const plan = summarizeReleasePlan({
      environment: { isProduction: true, isPreview: false },
      services: [{ id: 'svc-1', name: 'web', image: 'ghcr.io/demo/web:1' }],
      migrationSpecs: [
        {
          environment: { isProduction: true, isPreview: false },
          specification: {
            executionMode: 'automatic',
            phase: 'preDeploy',
            compatibility: 'breaking',
            approvalPolicy: 'auto',
          },
        },
      ],
    });

    expect(plan.canCreate).toBe(true);
    expect(plan.releasePolicy.requiresApproval).toBe(true);
    expect(plan.migration.requiresApproval).toBe(true);
    expect(plan.migration.preDeployCount).toBe(1);
    expect(plan.migration.automaticCount).toBe(1);
    expect(plan.summary).toBe('生产环境的破坏性迁移必须人工审批');
  });

  it('surfaces unresolved manual and external pre-deploy gates', () => {
    const plan = summarizeReleasePlan({
      environment: { isProduction: true, isPreview: false },
      services: [{ id: 'svc-1', name: 'web', image: 'ghcr.io/demo/web:1' }],
      migrationSpecs: [
        {
          environment: { isProduction: true, isPreview: false },
          specification: {
            executionMode: 'automatic',
            phase: 'preDeploy',
            compatibility: 'backward_compatible',
            approvalPolicy: 'auto',
          },
        },
        {
          environment: { isProduction: true, isPreview: false },
          specification: {
            executionMode: 'manual_platform',
            phase: 'preDeploy',
            compatibility: 'backward_compatible',
            approvalPolicy: 'manual_in_production',
          },
        },
        {
          environment: { isProduction: true, isPreview: false },
          specification: {
            executionMode: 'external',
            phase: 'preDeploy',
            compatibility: 'backward_compatible',
            approvalPolicy: 'auto',
          },
        },
        {
          environment: { isProduction: true, isPreview: false },
          specification: {
            executionMode: 'automatic',
            phase: 'postDeploy',
            compatibility: 'backward_compatible',
            approvalPolicy: 'auto',
          },
        },
      ],
    });

    expect(plan.blockingReason).toBe('存在未满足的前置迁移门禁');
    expect(plan.releasePolicy.requiresApproval).toBe(true);
    expect(plan.issue?.code).toBe('approval_blocked');
    expect(plan.migration.preDeployCount).toBe(3);
    expect(plan.migration.postDeployCount).toBe(1);
    expect(plan.migration.automaticCount).toBe(2);
    expect(plan.migration.manualPlatformCount).toBe(1);
    expect(plan.migration.externalCount).toBe(1);
    expect(plan.migration.requiresExternalCompletion).toBe(true);
  });
});
