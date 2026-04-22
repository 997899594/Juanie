import { describe, expect, it } from 'bun:test';
import {
  buildSchemaContractCommentLines,
  buildUnsupportedManagedSchemaSourceMessage,
  formatPlatformManagedSchemaSources,
  getPlatformManagedSchemaSources,
} from '@/lib/migrations/strategy';

describe('migration strategy guidance', () => {
  it('lists supported managed schema sources for postgresql in recommendation order', () => {
    expect(getPlatformManagedSchemaSources('postgresql')).toEqual(['drizzle', 'atlas', 'sql']);
    expect(formatPlatformManagedSchemaSources('postgresql')).toBe('drizzle / atlas / sql');
  });

  it('lists supported managed schema sources for mysql in recommendation order', () => {
    expect(getPlatformManagedSchemaSources('mysql')).toEqual(['drizzle', 'atlas', 'sql']);
    expect(formatPlatformManagedSchemaSources('mysql')).toBe('drizzle / atlas / sql');
  });

  it('reflects the current managed source contract for mongodb', () => {
    expect(getPlatformManagedSchemaSources('mongodb')).toEqual(['sql']);
    expect(formatPlatformManagedSchemaSources('mongodb')).toBe('sql');
  });

  it('explains that Atlas is the governance layer, not the only app release truth', () => {
    const message = buildUnsupportedManagedSchemaSourceMessage({
      serviceName: 'web',
      source: 'prisma',
      databaseType: 'postgresql',
      databaseName: 'primary',
    });

    expect(message).toContain('schema.source=drizzle / atlas / sql');
    expect(message).toContain('Atlas 做 diff / repair / adopt 治理');
    expect(message).toContain('不是要求子应用把发布主链统一改成 Atlas');
  });

  it('renders placeholder comments that describe the split between app truth and Atlas repair', () => {
    expect(buildSchemaContractCommentLines('    ')).toEqual([
      '    # Juanie could not infer a tracked schema source for this service.',
      '    # Add schema.source manually; the app keeps its own migration truth, and Juanie uses Atlas for diff / repair workflows.',
    ]);
  });
});
