import { describe, expect, it } from 'bun:test';
import {
  formatEnvironmentExpiry,
  formatEnvironmentTimestamp,
  getEnvironmentScopeLabel,
  getEnvironmentSourceBuildPresentation,
  getEnvironmentSourceLabel,
} from '@/lib/environments/presentation';

describe('environment presentation helpers', () => {
  it('formats preview source labels', () => {
    expect(getEnvironmentScopeLabel({ isPreview: true })).toBe('预览');
    expect(getEnvironmentSourceLabel({ isPreview: true, previewPrNumber: 18 })).toBe('PR #18');
    expect(getEnvironmentSourceLabel({ isPreview: true, branch: 'feature/release-intel' })).toBe(
      'feature/release-intel'
    );
    expect(getEnvironmentSourceLabel({ isPreview: false, branch: 'main' })).toBe(null);
    expect(
      getEnvironmentSourceLabel({
        kind: 'production',
        deliveryMode: 'promote_only',
      })
    ).toBe('仅接受提升');
  });

  it('formats expiry in relative Chinese labels', () => {
    const now = new Date('2026-03-25T00:00:00.000Z');
    expect(formatEnvironmentExpiry('2026-03-25T12:00:00.000Z', now)).toBe('12 小时后到期');
    expect(formatEnvironmentExpiry('2026-03-27T00:00:00.000Z', now)).toBe('2 天后到期');
    expect(formatEnvironmentExpiry('2026-03-24T00:00:00.000Z', now)).toBe('已过期');
  });

  it('formats absolute timestamps', () => {
    expect(formatEnvironmentTimestamp('2026-03-25T08:30:00.000Z')).toContain('3/');
    expect(formatEnvironmentTimestamp(null)).toBe(null);
  });

  it('builds persistent preview build summaries', () => {
    const building = getEnvironmentSourceBuildPresentation({
      environment: {
        isPreview: true,
        previewPrNumber: 42,
        previewBuildStatus: 'building',
        previewBuildSourceCommitSha: 'abc123456789',
        previewBuildStartedAt: '2026-03-25T08:30:00.000Z',
      },
    });

    expect(building?.label).toBe('预览构建中');
    expect(building?.tone).toBe('neutral');
    expect(building?.status).toBe('building');
    expect(building?.shortCommitSha).toBe('abc1234');

    const failed = getEnvironmentSourceBuildPresentation({
      environment: {
        isPreview: true,
        branch: 'feature/search',
        previewBuildStatus: 'failed',
        previewBuildSourceCommitSha: 'def987654321',
      },
    });

    expect(failed?.label).toBe('预览构建失败');
    expect(failed?.tone).toBe('danger');
    expect(failed?.status).toBe('failed');
    expect(failed?.shortCommitSha).toBe('def9876');
  });

  it('builds persistent source build summaries for first direct deploys', () => {
    const building = getEnvironmentSourceBuildPresentation({
      environment: {
        kind: 'persistent',
        branch: 'main',
        previewBuildStatus: 'building',
        previewBuildSourceCommitSha: 'fedcba9876543210',
      },
    });

    expect(building?.label).toBe('首发构建中');
    expect(building?.summary).toContain('自动创建首个版本');
    expect(building?.shortCommitSha).toBe('fedcba9');
  });
});
