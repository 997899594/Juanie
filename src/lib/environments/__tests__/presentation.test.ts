import { describe, expect, it } from 'bun:test';
import {
  formatEnvironmentExpiry,
  formatEnvironmentTimestamp,
  getEnvironmentScopeLabel,
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
});
