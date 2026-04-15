import { describe, expect, it } from 'bun:test';
import { buildDefaultReleaseSummary, getReleaseDisplayTitle } from '@/lib/releases/presentation';

describe('release presentation helpers', () => {
  it('builds preview PR summaries', () => {
    expect(
      buildDefaultReleaseSummary({
        sourceRef: 'refs/pull/42/merge',
        sourceCommitSha: 'abcdef123456',
        environment: { kind: 'preview' },
      })
    ).toBe('PR #42 预览 · abcdef1');
  });

  it('builds preview branch summaries', () => {
    expect(
      buildDefaultReleaseSummary({
        sourceRef: 'refs/heads/feature/release-intel',
        sourceCommitSha: 'abcdef123456',
        environment: { kind: 'preview' },
      })
    ).toBe('feature/release-intel 预览 · abcdef1');
  });

  it('builds tag summaries', () => {
    expect(
      buildDefaultReleaseSummary({
        sourceRef: 'refs/tags/v1.2.0',
        sourceCommitSha: 'abcdef123456',
      })
    ).toBe('标签 v1.2.0 · abcdef1');
  });

  it('prefers explicit summaries', () => {
    expect(
      getReleaseDisplayTitle({
        summary: 'Promote abcdef1 to production',
        sourceRef: 'refs/heads/main',
        sourceCommitSha: 'abcdef123456',
      })
    ).toBe('Promote abcdef1 to production');
  });
});
