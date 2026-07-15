import { describe, expect, it } from 'bun:test';
import {
  buildAtlasMigrateApplyArgs,
  getAtlasSchemaDiffExcludePatterns,
  getAtlasSchemaDiffScopeArgs,
  getPostgresSchemaNamesFromDatabaseUrl,
  isAtlasTargetVersionApplied,
  selectAtlasMigrationsThroughTarget,
  summarizeAtlasSchemaDiffOutput,
} from '@/lib/migrations/atlas';
import {
  buildPostgresScratchDatabaseUrl,
  getAtlasDevUrlEnvNames,
  getDefaultAtlasDevUrl,
  resolveAtlasDevUrlOverrideFromEnv,
} from '@/lib/migrations/atlas-dev-database';

describe('atlas migration helpers', () => {
  it('pins release graph execution to the declared stage target', () => {
    expect(
      buildAtlasMigrateApplyArgs({
        databaseUrl: 'postgres://app:secret@db/app',
        targetVersion: '2026071403',
        baselineVersion: '2026071400',
      })
    ).toEqual([
      'migrate',
      'apply',
      '--dir',
      'file://migrations',
      '--url',
      'postgres://app:secret@db/app',
      '--revisions-schema',
      'public',
      '--to-version',
      '2026071403',
      '--baseline',
      '2026071400',
    ]);
  });

  it('limits release graph previews to migrations at or before the stage target', () => {
    const files = [
      { name: '2026071401_expand.sql' },
      { name: '2026071402_backfill.sql' },
      { name: '2026071403_verify.sql' },
      { name: '2026071404_contract.sql' },
    ];

    expect(selectAtlasMigrationsThroughTarget(files, '2026071402')).toEqual(files.slice(0, 2));
  });

  it('recognizes release graph stages completed by an earlier release', () => {
    const appliedVersions = ['2026071401', '2026071402', '2026071403'];

    expect(isAtlasTargetVersionApplied(appliedVersions, '2026071401')).toBe(true);
    expect(isAtlasTargetVersionApplied(appliedVersions, '2026071403')).toBe(true);
    expect(isAtlasTargetVersionApplied(appliedVersions, '2026071404')).toBe(false);
    expect(isAtlasTargetVersionApplied(appliedVersions, null)).toBe(false);
  });

  it('keeps docker dev urls as the last-resort fallback', () => {
    expect(getDefaultAtlasDevUrl('postgresql')).toBe('docker://postgres/17/dev');
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

  it('uses an isolated scratch database instead of schema-scoped search_path', () => {
    expect(
      buildPostgresScratchDatabaseUrl(
        'postgresql://postgres:postgres@postgres.juanie.svc.cluster.local:5432/juanie?sslmode=disable&search_path=public',
        'atlas_dev_probe'
      )
    ).toBe(
      'postgresql://postgres:postgres@postgres.juanie.svc.cluster.local:5432/atlas_dev_probe?sslmode=disable'
    );
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

  it('scopes PostgreSQL schema diff to the application search path', () => {
    expect(
      getPostgresSchemaNamesFromDatabaseUrl(
        'postgresql://postgres:postgres@postgres:5432/app?sslmode=disable'
      )
    ).toEqual(['public']);

    expect(
      getPostgresSchemaNamesFromDatabaseUrl(
        'postgresql://postgres:postgres@postgres:5432/app?search_path=tenant_a,public'
      )
    ).toEqual(['tenant_a', 'public']);

    expect(
      getPostgresSchemaNamesFromDatabaseUrl(
        'postgresql://postgres:postgres@postgres:5432/app?search_path=%24user,public'
      )
    ).toEqual(['public']);

    expect(
      getAtlasSchemaDiffScopeArgs(
        'postgresql',
        'postgresql://postgres:postgres@postgres:5432/app?search_path=public'
      )
    ).toEqual(['--schema', 'public']);
    expect(getAtlasSchemaDiffScopeArgs('mysql', 'mysql://root:root@mysql:3306/app')).toEqual([]);
  });

  it('extracts the first meaningful atlas diff line for user-facing summaries', () => {
    expect(
      summarizeAtlasSchemaDiffOutput(
        '\n\n-- create "users" table\nCREATE TABLE "users" ("id" int);\n'
      )
    ).toBe('-- create "users" table');
  });
});
