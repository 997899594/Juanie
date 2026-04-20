import { describe, expect, it } from 'bun:test';
import { resolveProjectPreviewDatabaseStrategy } from '@/lib/environments/database-strategy';

describe('preview database strategy resolution', () => {
  it('prefers the explicitly requested strategy', () => {
    expect(resolveProjectPreviewDatabaseStrategy(null, 'inherit')).toBe('inherit');
    expect(resolveProjectPreviewDatabaseStrategy(null, 'isolated_clone')).toBe('isolated_clone');
  });

  it('falls back to project defaults when no explicit strategy is provided', () => {
    expect(
      resolveProjectPreviewDatabaseStrategy({
        creationDefaults: {
          previewDatabaseStrategy: 'isolated_clone',
        },
      })
    ).toBe('isolated_clone');

    expect(
      resolveProjectPreviewDatabaseStrategy({
        creationDefaults: {
          previewDatabaseStrategy: 'inherit',
        },
      })
    ).toBe('inherit');
  });

  it('defaults to inherit for missing or malformed config', () => {
    expect(resolveProjectPreviewDatabaseStrategy(null)).toBe('inherit');
    expect(resolveProjectPreviewDatabaseStrategy({})).toBe('inherit');
    expect(
      resolveProjectPreviewDatabaseStrategy({
        creationDefaults: 'broken',
      })
    ).toBe('inherit');
  });
});
