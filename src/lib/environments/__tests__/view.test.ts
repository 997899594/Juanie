import { describe, expect, it } from 'bun:test';
import { decorateEnvironmentList } from '@/lib/environments/view';

describe('environment list view', () => {
  it('adds policy snapshots for production and preview environments', () => {
    const environments = decorateEnvironmentList([
      {
        id: 'env-prod',
        name: 'production',
        isProduction: true,
        isPreview: false,
      },
      {
        id: 'env-preview',
        name: 'preview-pr-42',
        isProduction: false,
        isPreview: true,
      },
    ]);

    expect(environments[0]?.policy.level).toBe('protected');
    expect(environments[0]?.policy.reasons).toEqual(['生产环境已启用保护']);
    expect(environments[0]?.policy.summary).toBe('生产环境已启用保护');
    expect(environments[0]?.policy.signals[0]?.code).toBe('production_protected');

    expect(environments[1]?.policy.level).toBe('preview');
    expect(environments[1]?.policy.reasons).toEqual(['预览环境会自动回收']);
    expect(environments[1]?.policy.summary).toBe('预览环境会自动回收');
    expect(environments[1]?.policy.signals[0]?.code).toBe('preview_auto_cleanup');
  });

  it('surfaces persistent preview build state through platform signals', () => {
    const [environment] = decorateEnvironmentList([
      {
        id: 'env-preview',
        name: 'preview-pr-42',
        kind: 'preview' as const,
        previewPrNumber: 42,
        previewBuildStatus: 'building',
        previewBuildSourceCommitSha: 'abc123456789',
        previewBuildStartedAt: '2026-03-25T08:30:00.000Z',
      },
    ]);

    expect(environment?.platformSignals.primarySummary).toContain('平台已触发仓库构建');
    expect(environment?.platformSignals.nextActionLabel !== null).toBe(true);
  });
});
