import { describe, expect, it } from 'bun:test';
import {
  canManageEnvironment,
  evaluateEnvironmentPolicy,
  evaluateMigrationPolicy,
  evaluateReleasePolicy,
  getEnvironmentGuardReason,
} from '@/lib/policies/delivery';

describe('delivery policy', () => {
  it('allows only owner/admin to manage production environments', () => {
    expect(canManageEnvironment('owner', { isProduction: true })).toBe(true);
    expect(canManageEnvironment('admin', { isProduction: true })).toBe(true);
    expect(canManageEnvironment('member', { isProduction: true })).toBe(false);
  });

  it('allows members to manage non-production environments', () => {
    expect(canManageEnvironment('member', { isProduction: false })).toBe(true);
  });

  it('evaluates migration approval policy consistently', () => {
    const decision = evaluateMigrationPolicy({
      environment: { isProduction: true },
      specification: {
        compatibility: 'breaking',
        approvalPolicy: 'manual_in_production',
      },
    });

    expect(decision.requiresApproval).toBe(true);
    expect(decision.approvalReason).toBe('生产环境的破坏性迁移必须人工审批');
    expect(decision.warnings).toContain('这次迁移会作用到生产环境。');
    expect(decision.warnings).toContain('这次迁移被标记为破坏性变更。');
    expect(decision.warnings).toContain('生产环境的破坏性迁移必须人工审批。');
  });

  it('returns the correct production guard message', () => {
    expect(getEnvironmentGuardReason({ isProduction: true })).toBe(
      '生产环境只允许 owner 或 admin 执行此操作'
    );
  });

  it('evaluates environment policy consistently', () => {
    const productionPolicy = evaluateEnvironmentPolicy({ isProduction: true });
    expect(productionPolicy.level).toBe('protected');
    expect(productionPolicy.reasons).toEqual(['生产环境已启用保护']);
    expect(productionPolicy.summary).toBe('生产环境已启用保护');
    expect(productionPolicy.signals[0]?.code).toBe('production_protected');

    const previewPolicy = evaluateEnvironmentPolicy({ isPreview: true });
    expect(previewPolicy.level).toBe('preview');
    expect(previewPolicy.reasons).toEqual(['预览环境会自动回收']);
    expect(previewPolicy.summary).toBe('预览环境会自动回收');
    expect(previewPolicy.signals[0]?.code).toBe('preview_auto_cleanup');

    expect(evaluateEnvironmentPolicy({ isProduction: false, isPreview: false })).toEqual({
      level: 'normal',
      reasons: [],
      summary: null,
      signals: [],
      primarySignal: null,
    });
  });

  it('evaluates release policy for protected production releases', () => {
    const snapshot = evaluateReleasePolicy({
      environment: { isProduction: true },
      migrationRuns: [
        {
          specification: {
            compatibility: 'breaking',
            approvalPolicy: 'auto',
          },
        },
      ],
    });

    expect(snapshot.level).toBe('approval_required');
    expect(snapshot.requiresApproval).toBe(true);
    expect(snapshot.summary).toBe('生产环境的破坏性迁移必须人工审批');
    expect(snapshot.reasons).toContain('生产环境已启用保护');
    expect(snapshot.reasons).toContain('生产环境包含破坏性迁移');
  });
});
