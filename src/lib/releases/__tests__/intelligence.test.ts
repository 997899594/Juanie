import { describe, expect, it } from 'bun:test';
import {
  getIssueLabel,
  getMigrationAttentionIssueCode,
  getReleaseActionLabel,
  getReleaseFailureSummary,
  getReleaseIntelligenceSnapshot,
  getReleaseIssueCode,
} from '@/lib/releases/intelligence';

describe('release intelligence', () => {
  it('marks production releases as medium risk by default', () => {
    const snapshot = getReleaseIntelligenceSnapshot({
      status: 'succeeded',
      environment: { isProduction: true },
      deployments: [],
      migrationRuns: [],
    });

    expect(snapshot.riskLevel).toBe('medium');
    expect(snapshot.reasons).toContain('生产环境发布');
  });

  it('escalates to high risk for approval-gated migrations', () => {
    const snapshot = getReleaseIntelligenceSnapshot({
      status: 'migration_pre_running',
      environment: { isProduction: true },
      deployments: [],
      migrationRuns: [
        {
          status: 'awaiting_approval',
          specification: {
            compatibility: 'backward_compatible',
            approvalPolicy: 'manual_in_production',
          },
        },
      ],
    });

    expect(snapshot.riskLevel).toBe('high');
    expect(snapshot.reasons).toContain('存在待审批迁移');
    expect(snapshot.issueCode).toBe('approval_blocked');
    expect(snapshot.actionLabel).toBe('处理迁移审批');
  });

  it('classifies breaking migrations as high risk', () => {
    const snapshot = getReleaseIntelligenceSnapshot({
      status: 'queued',
      environment: { isProduction: false },
      deployments: [],
      migrationRuns: [
        {
          status: 'queued',
          specification: {
            compatibility: 'breaking',
            approvalPolicy: 'auto',
          },
        },
      ],
    });

    expect(snapshot.riskLevel).toBe('high');
    expect(snapshot.reasons).toContain('包含破坏性迁移');
  });

  it('prefers explicit release errors in the failure summary', () => {
    expect(
      getReleaseFailureSummary({
        status: 'failed',
        errorMessage: '镜像不存在',
        deployments: [{ status: 'failed' }],
        migrationRuns: [{ status: 'failed' }],
      })
    ).toBe('镜像不存在');
  });

  it('falls back to deployment or migration failure summaries', () => {
    expect(
      getReleaseFailureSummary({
        status: 'failed',
        deployments: [{ status: 'failed' }],
        migrationRuns: [],
      })
    ).toBe('部署执行失败');

    expect(
      getReleaseFailureSummary({
        status: 'failed',
        deployments: [],
        migrationRuns: [{ status: 'failed' }],
      })
    ).toBe('迁移执行失败');
  });

  it('adds preview release context without forcing high risk', () => {
    const snapshot = getReleaseIntelligenceSnapshot({
      status: 'succeeded',
      environment: {
        isProduction: false,
        isPreview: true,
        expiresAt: '2999-01-01T00:00:00.000Z',
      },
      deployments: [],
      migrationRuns: [],
    });

    expect(snapshot.riskLevel).toBe('low');
    expect(snapshot.reasons).toContain('预览环境发布');
  });

  it('raises preview releases to medium risk when near expiry', () => {
    const soon = new Date(Date.now() + 6 * 60 * 60 * 1000).toISOString();
    const snapshot = getReleaseIntelligenceSnapshot({
      status: 'succeeded',
      environment: {
        isProduction: false,
        isPreview: true,
        expiresAt: soon,
      },
      deployments: [],
      migrationRuns: [],
    });

    expect(snapshot.riskLevel).toBe('medium');
    expect(snapshot.reasons).toContain('预览环境即将过期');
  });

  it('classifies issue codes for failure and expiry states', () => {
    expect(
      getReleaseIssueCode({
        status: 'failed',
        deployments: [{ status: 'failed' }],
        migrationRuns: [],
      })
    ).toBe('deployment_failed');

    expect(
      getReleaseIssueCode({
        status: 'succeeded',
        environment: {
          isPreview: true,
          expiresAt: '2020-01-01T00:00:00.000Z',
        },
        deployments: [],
        migrationRuns: [],
      })
    ).toBe('preview_expired');
  });

  it('maps issue codes to next actions', () => {
    expect(getReleaseActionLabel('migration_failed')).toBe('检查迁移并重试');
    expect(getReleaseActionLabel('preview_expired')).toBe('重新创建预览环境');
  });

  it('classifies migration attention runs with the same issue vocabulary', () => {
    expect(
      getMigrationAttentionIssueCode({
        status: 'awaiting_approval',
      })
    ).toBe('approval_blocked');

    expect(
      getMigrationAttentionIssueCode({
        status: 'failed',
      })
    ).toBe('migration_failed');

    expect(
      getMigrationAttentionIssueCode({
        status: 'canceled',
      })
    ).toBe('migration_canceled');

    expect(
      getMigrationAttentionIssueCode({
        status: 'success',
        environment: {
          isPreview: true,
          expiresAt: '2020-01-01T00:00:00.000Z',
        },
      })
    ).toBe('preview_expired');
  });

  it('maps issue codes to user-facing labels', () => {
    expect(getIssueLabel('approval_blocked')).toBe('审批阻塞');
    expect(getIssueLabel('migration_failed')).toBe('迁移失败');
    expect(getIssueLabel('preview_expired')).toBe('预览已过期');
  });
});
