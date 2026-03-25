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
            autoRun: true,
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
    expect(plan.summary).toBe('生产环境的破坏性迁移必须人工审批');
  });

  it('summarizes preview plans without forcing approval', () => {
    const plan = summarizeReleasePlan({
      environment: { isProduction: false, isPreview: true },
      services: [{ id: 'svc-1', name: 'web', image: 'ghcr.io/demo/web:1' }],
      migrationSpecs: [
        {
          environment: { isProduction: false, isPreview: true },
          specification: {
            autoRun: true,
            phase: 'postDeploy',
            compatibility: 'backward_compatible',
            approvalPolicy: 'auto',
          },
        },
      ],
    });

    expect(plan.environmentPolicy.level).toBe('preview');
    expect(plan.releasePolicy.requiresApproval).toBe(false);
    expect(plan.migration.postDeployCount).toBe(1);
    expect(plan.migration.warnings).toContain('这次迁移会作用到预览环境。');
  });
});
