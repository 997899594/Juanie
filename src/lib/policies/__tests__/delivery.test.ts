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
    expect(evaluateEnvironmentPolicy({ isProduction: true })).toEqual({
      level: 'protected',
      reasons: ['生产环境已启用保护'],
      summary: '生产环境已启用保护',
    });
    expect(evaluateEnvironmentPolicy({ isPreview: true })).toEqual({
      level: 'preview',
      reasons: ['预览环境会自动回收'],
      summary: '预览环境会自动回收',
    });
    expect(evaluateEnvironmentPolicy({ isProduction: false, isPreview: false })).toEqual({
      level: 'normal',
      reasons: [],
      summary: null,
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
