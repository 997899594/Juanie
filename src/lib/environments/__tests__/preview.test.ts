import { describe, expect, it } from 'bun:test';
import {
  buildPreviewEnvironmentName,
  buildPreviewNamespace,
  calculatePreviewExpiry,
  extractBranchFromRef,
  extractPrNumberFromRef,
  isPreviewEnvironmentExpired,
  resolvePreviewEnvironment,
} from '@/lib/environments/preview';

describe('preview environments', () => {
  it('extracts branch refs', () => {
    expect(extractBranchFromRef('refs/heads/feature/release-intel')).toBe('feature/release-intel');
    expect(extractBranchFromRef('refs/tags/v1.0.0')).toBe(null);
  });

  it('extracts PR refs', () => {
    expect(extractPrNumberFromRef('refs/pull/42/merge')).toBe(42);
    expect(extractPrNumberFromRef('refs/heads/main')).toBe(null);
  });

  it('builds deterministic preview names', () => {
    expect(buildPreviewEnvironmentName({ prNumber: 42 })).toBe('preview-pr-42');
    expect(buildPreviewEnvironmentName({ branch: 'feature/release-intel' })).toBe(
      'preview-feature-release-intel'
    );
  });

  it('builds predictable namespaces', () => {
    expect(buildPreviewNamespace('juanie', 'preview-feature-release-intel')).toBe(
      'juanie-preview-feature-release-intel'
    );
  });

  it('calculates preview expiry', () => {
    const now = new Date('2026-03-25T00:00:00.000Z');
    expect(calculatePreviewExpiry(24, now).toISOString()).toBe('2026-03-26T00:00:00.000Z');
  });

  it('resolves preview environments by branch or PR ref', () => {
    const environments = [
      {
        id: 'env_pr',
        name: 'preview-pr-42',
        branch: null,
        isPreview: true,
        previewPrNumber: 42,
      },
      {
        id: 'env_branch',
        name: 'preview-feature-release-intel',
        branch: 'feature/release-intel',
        isPreview: true,
        previewPrNumber: null,
      },
    ];

    expect(resolvePreviewEnvironment('refs/pull/42/merge', environments)?.id).toBe('env_pr');
    expect(resolvePreviewEnvironment('refs/heads/feature/release-intel', environments)?.id).toBe(
      'env_branch'
    );
  });

  it('detects expired preview environments', () => {
    expect(isPreviewEnvironmentExpired({ expiresAt: '2020-01-01T00:00:00.000Z' })).toBe(true);
    expect(isPreviewEnvironmentExpired({ expiresAt: '2999-01-01T00:00:00.000Z' })).toBe(false);
  });
});
