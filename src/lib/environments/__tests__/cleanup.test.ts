import { describe, expect, it } from 'bun:test';
import { isActivePreviewReleaseStatus } from '@/lib/environments/cleanup';

describe('preview cleanup guards', () => {
  it('treats in-flight release statuses as active', () => {
    expect(isActivePreviewReleaseStatus('queued')).toBe(true);
    expect(isActivePreviewReleaseStatus('deploying')).toBe(true);
    expect(isActivePreviewReleaseStatus('migration_post_running')).toBe(true);
  });

  it('does not treat terminal statuses as active', () => {
    expect(isActivePreviewReleaseStatus('succeeded')).toBe(false);
    expect(isActivePreviewReleaseStatus('failed')).toBe(false);
    expect(isActivePreviewReleaseStatus('canceled')).toBe(false);
    expect(isActivePreviewReleaseStatus('migration_pre_failed')).toBe(false);
  });
});
