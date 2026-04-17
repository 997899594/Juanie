import { describe, expect, it } from 'bun:test';
import {
  buildApprovalStats,
  buildApprovalsFilterHref,
  decorateApprovalRuns,
  formatApprovalStatusLabel,
  normalizeApprovalFilterState,
} from '@/lib/approvals/view';

describe('approvals view', () => {
  it('normalizes filter state and builds hrefs', () => {
    expect(normalizeApprovalFilterState('approval')).toBe('approval');
    expect(normalizeApprovalFilterState('external')).toBe('external');
    expect(normalizeApprovalFilterState('weird')).toBe('all');
    expect(buildApprovalsFilterHref('all')).toBe('/inbox');
    expect(buildApprovalsFilterHref('failed')).toBe('/inbox?state=failed');
  });

  it('formats stats and statuses', () => {
    expect(formatApprovalStatusLabel('awaiting_approval')).toBe('待审批');
    expect(
      buildApprovalStats({
        total: 3,
        approval: 1,
        external: 1,
        failed: 1,
        canceled: 1,
      })
    ).toEqual([
      { label: '待处理', value: 3 },
      { label: '待审批', value: 1 },
      { label: '待外部完成', value: 1 },
      { label: '失败', value: 1 },
      { label: '已取消', value: 1 },
    ]);
  });

  it('decorates approval runs with issue, domain and branch metadata', () => {
    const result = decorateApprovalRuns([
      {
        id: 'run-1',
        projectId: 'proj-1',
        releaseId: 'rel-1',
        serviceId: 'svc-1',
        status: 'awaiting_approval',
        createdAt: '2026-03-26T00:00:00.000Z',
        database: { name: 'postgres', type: 'postgresql' },
        environment: {
          id: 'env-preview-42',
          name: 'preview-pr-42',
          branch: 'main',
          isPreview: true,
          domains: [{ hostname: 'preview.example.com', isPrimary: true }],
        },
        project: { name: 'demo' },
        service: { name: 'web' },
        specification: { tool: 'drizzle', phase: 'preDeploy', command: 'bun run db:push' },
        release: {
          sourceRef: 'refs/pull/42/head',
          artifacts: [{ serviceId: 'svc-1', imageUrl: 'ghcr.io/demo/web:1' }],
        },
      },
    ]);

    expect(result[0]?.issueLabel).toBe('审批阻塞');
    expect(result[0]?.actionLabel).toBe('处理迁移审批');
    expect(result[0]?.primaryDomainUrl).toBe('https://preview.example.com');
    expect(result[0]?.imageUrl).toBe('ghcr.io/demo/web:1');
    expect(result[0]?.branchLabel).toBe('refs/pull/42/head');
  });

  it('decorates external completion runs with the external issue vocabulary', () => {
    const result = decorateApprovalRuns([
      {
        id: 'run-2',
        projectId: 'proj-1',
        status: 'awaiting_external_completion',
        createdAt: '2026-03-26T00:00:00.000Z',
        database: { name: 'postgres', type: 'postgresql' },
        environment: {
          id: 'env-production',
          name: 'production',
          isPreview: false,
          domains: [],
        },
        project: { name: 'demo' },
        specification: { tool: 'drizzle', phase: 'preDeploy', command: 'bun run db:migrate' },
      },
    ]);

    expect(result[0]?.issueLabel).toBe('外部迁移阻塞');
    expect(result[0]?.actionLabel).toBe('标记外部迁移结果');
  });
});
