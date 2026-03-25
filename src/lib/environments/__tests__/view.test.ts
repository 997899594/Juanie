import { describe, expect, it } from 'bun:test';
import { decorateEnvironmentList } from '@/lib/environments/view';

describe('environment list view', () => {
  it('adds policy snapshots for production and preview environments', () => {
    const environments = decorateEnvironmentList([
      {
        id: 'env-prod',
        isProduction: true,
        isPreview: false,
      },
      {
        id: 'env-preview',
        isProduction: false,
        isPreview: true,
      },
    ]);

    expect(environments[0]?.policy).toEqual({
      level: 'protected',
      reasons: ['生产环境已启用保护'],
      summary: '生产环境已启用保护',
    });
    expect(environments[1]?.policy).toEqual({
      level: 'preview',
      reasons: ['预览环境会自动回收'],
      summary: '预览环境会自动回收',
    });
  });
});
