import { describe, expect, it } from 'bun:test';
import {
  getAtlasSchemaDiffExcludePatterns,
  summarizeAtlasSchemaDiffOutput,
} from '@/lib/migrations/atlas';
import {
  buildPostgresScratchSearchPath,
  getAtlasDevUrlEnvNames,
  getDefaultAtlasDevUrl,
  resolveAtlasDevUrlOverrideFromEnv,
} from '@/lib/migrations/atlas-dev-database';

describe('atlas migration helpers', () => {
  it('keeps docker dev urls as the last-resort fallback', () => {
    expect(getDefaultAtlasDevUrl('postgresql')).toBe('docker://postgres/16/dev');
    expect(getDefaultAtlasDevUrl('mysql')).toBe('docker://mysql/8/dev');
  });

  it('prefers database-specific atlas dev url overrides', () => {
    expect(
      resolveAtlasDevUrlOverrideFromEnv('postgresql', {
        ATLAS_DEV_URL_POSTGRESQL: 'postgresql://postgres:postgres@postgres/dev',
        ATLAS_DEV_URL: 'postgresql://shared/shared',
      })
    ).toBe('postgresql://postgres:postgres@postgres/dev');

    expect(
      resolveAtlasDevUrlOverrideFromEnv('mysql', {
        ATLAS_DEV_URL_MYSQL: 'mysql://root:root@mysql/dev',
        ATLAS_DEV_URL: 'mysql://shared/shared',
      })
    ).toBe('mysql://root:root@mysql/dev');
  });

  it('exposes the expected env names for atlas dev url overrides', () => {
    expect(getAtlasDevUrlEnvNames('postgresql')).toEqual([
      'ATLAS_DEV_URL_POSTGRESQL',
      'ATLAS_DEV_URL',
    ]);
    expect(getAtlasDevUrlEnvNames('mysql')).toEqual(['ATLAS_DEV_URL_MYSQL', 'ATLAS_DEV_URL']);
  });

  it('keeps public in the postgres scratch search_path so extensions remain visible', () => {
    expect(buildPostgresScratchSearchPath('atlas_dev_probe')).toBe('atlas_dev_probe,public');
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
