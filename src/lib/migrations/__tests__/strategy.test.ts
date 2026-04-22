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

  it('keeps mongodb external-only for schema execution', () => {
    expect(getPlatformManagedSchemaSources('mongodb')).toEqual([]);
    expect(formatPlatformManagedSchemaSources('mongodb')).toBe(null);
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

  it('does not claim Atlas governance for databases outside the relational support matrix', () => {
    const message = buildUnsupportedManagedSchemaSourceMessage({
      serviceName: 'worker',
      source: 'sql',
      databaseType: 'mongodb',
      databaseName: 'analytics',
    });

    expect(message).toContain('请改为 external');
    expect(message).toContain('mongodb 还没有平台托管迁移执行器');
    expect(message).toContain('不支持平台内 schema 治理');
    expect(message).not.toContain('Atlas 做 diff / repair / adopt 治理');
  });

  it('renders placeholder comments that describe the split between app truth and Atlas repair', () => {
    expect(buildSchemaContractCommentLines('    ')).toEqual([
      '    # Juanie could not infer a tracked schema source for this service.',
      '    # Add schema.source manually; the app keeps its own migration truth, and Juanie uses Atlas for diff / repair workflows.',
    ]);
  });
});
