import { describe, expect, it } from 'bun:test';
import {
  getAtlasSchemaDiffExcludePatterns,
  getDefaultAtlasDevUrl,
  summarizeAtlasSchemaDiffOutput,
} from '@/lib/migrations/atlas';

describe('atlas migration helpers', () => {
  it('uses database-specific dev urls for schema diff replay', () => {
    expect(getDefaultAtlasDevUrl('postgresql')).toBe('docker://postgres/16/dev');
    expect(getDefaultAtlasDevUrl('mysql')).toBe('docker://mysql/8/dev');
  });

  it('excludes platform ledger tables from schema diff', () => {
    expect(getAtlasSchemaDiffExcludePatterns('postgresql')).toEqual([
      '*.atlas_schema_revisions',
      'drizzle.__drizzle_migrations',
    ]);
    expect(getAtlasSchemaDiffExcludePatterns('mysql')).toEqual([
      '*.atlas_schema_revisions',
      '*.__drizzle_migrations',
    ]);
  });

  it('extracts the first meaningful atlas diff line for user-facing summaries', () => {
    expect(
      summarizeAtlasSchemaDiffOutput(
        '\n\n-- create "users" table\nCREATE TABLE "users" ("id" int);\n'
      )
    ).toBe('-- create "users" table');
  });
});
