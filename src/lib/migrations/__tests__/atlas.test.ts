import { describe, expect, it } from 'bun:test';
import {
  buildAtlasMigrateApplyArgs,
  buildAtlasMigrateSetArgs,
  getAtlasSchemaDiffExcludePatterns,
  getAtlasSchemaDiffScopeArgs,
  getPostgresSchemaNamesFromDatabaseUrl,
  resolveAtlasBoundedMigrationCount,
  summarizeAtlasSchemaDiffOutput,
} from '@/lib/migrations/atlas';
import {
  buildPostgresScratchDatabaseUrl,
  getAtlasDevUrlEnvNames,
  getDefaultAtlasDevUrl,
  resolveAtlasDevUrlOverrideFromEnv,
} from '@/lib/migrations/atlas-dev-database';
import {
  getAtlasDeclaredVersions,
  isAtlasTargetVersionApplied,
  selectAtlasMigrationsThroughTarget,
} from '@/lib/migrations/atlas-versioning';

describe('atlas migration helpers', () => {
  it('passes the planned migration count as the community apply positional argument', () => {
    expect(
      buildAtlasMigrateApplyArgs({
        databaseUrl: 'postgres://app:secret@db/app',
        migrationCount: 3,
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
      '3',
    ]);
  });

  it('uses Atlas linear-skip only for an explicit history reconciliation', () => {
    expect(
      buildAtlasMigrateApplyArgs({
        databaseUrl: 'postgres://app:secret@db/app',
        migrationCount: 1,
        executionOrder: 'linear-skip',
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
      '--exec-order',
      'linear-skip',
      '1',
    ]);
  });

  it('builds an explicit baseline adoption command', () => {
    expect(
      buildAtlasMigrateSetArgs({
        databaseUrl: 'postgres://app:secret@db/app',
        version: '2026071400',
      })
    ).toEqual([
      'migrate',
      'set',
      '2026071400',
      '--dir',
      'file://migrations',
      '--url',
      'postgres://app:secret@db/app',
      '--revisions-schema',
      'public',
    ]);
  });

  it('plans an exact bounded count from fresh and partially applied histories', () => {
    const declaredVersions = ['2026071401', '2026071402', '2026071403', '2026071404'];

    expect(
      resolveAtlasBoundedMigrationCount({
        declaredVersions,
        appliedVersions: [],
        targetVersion: '2026071403',
      })
    ).toBe(3);
    expect(
      resolveAtlasBoundedMigrationCount({
        declaredVersions,
        appliedVersions: ['2026071401'],
        targetVersion: '2026071403',
      })
    ).toBe(2);
    expect(
      resolveAtlasBoundedMigrationCount({
        declaredVersions,
        appliedVersions: ['2026071401', '2026071402', '2026071403'],
        targetVersion: '2026071403',
      })
    ).toBe(0);
    expect(
      resolveAtlasBoundedMigrationCount({
        declaredVersions,
        appliedVersions: ['2026071401'],
        targetVersion: null,
      })
    ).toBe(null);
  });

  it('derives migration order independently from provider directory ordering', () => {
    expect(
      getAtlasDeclaredVersions([
        { name: '2026071403_verify.sql' },
        { name: '2026071401_expand.sql' },
        { name: 'README.md' },
        { name: '2026071402_backfill.sql' },
      ])
    ).toEqual(['2026071401', '2026071402', '2026071403']);
  });

  it('rejects invalid bounded migration histories before execution', () => {
    expect(() =>
      resolveAtlasBoundedMigrationCount({
        declaredVersions: ['2026071401', '2026071402'],
        appliedVersions: [],
        targetVersion: '2026071499',
      })
    ).toThrow('targets undeclared version');
    expect(() =>
      resolveAtlasBoundedMigrationCount({
        declaredVersions: ['2026071401', '2026071402'],
        appliedVersions: ['2026071399'],
        targetVersion: '2026071402',
      })
    ).toThrow('contains undeclared applied version');
    expect(() =>
      resolveAtlasBoundedMigrationCount({
        declaredVersions: ['2026071401', '2026071402', '2026071403'],
        appliedVersions: ['2026071403'],
        targetVersion: '2026071402',
      })
    ).toThrow('has advanced beyond missing target');
    expect(() =>
      resolveAtlasBoundedMigrationCount({
        declaredVersions: ['2026071401', '2026071401'],
        appliedVersions: [],
        targetVersion: '2026071401',
      })
    ).toThrow('duplicate declared version');
  });

  it('allows a historical gap only at its adjacent reconciliation checkpoint', () => {
    const declaredVersions = [
      '20260712000000',
      '20260713120000',
      '20260713121000',
      '20260714100000',
      '20260714110000',
      '20260714120000',
      '20260714130000',
      '20260715120000',
    ];
    const appliedVersions = ['20260712000000', '20260714120000'];

    expect(
      resolveAtlasBoundedMigrationCount({
        declaredVersions,
        appliedVersions,
        targetVersion: '20260714130000',
        historyReconciliationVersion: '20260714130000',
      })
    ).toBe(1);
    expect(() =>
      resolveAtlasBoundedMigrationCount({
        declaredVersions,
        appliedVersions,
        targetVersion: '20260715120000',
        historyReconciliationVersion: '20260714130000',
      })
    ).toThrow('contains a gap');
  });

  it('resumes a reconciliation checkpoint that applied before ledger canonicalization', () => {
    expect(
      resolveAtlasBoundedMigrationCount({
        declaredVersions: ['20260712000000', '20260713120000', '20260714120000', '20260714130000'],
        appliedVersions: ['20260712000000', '20260714120000', '20260714130000'],
        targetVersion: '20260714130000',
        historyReconciliationVersion: '20260714130000',
      })
    ).toBe(0);
  });

  it('treats an applied reconciliation checkpoint as the new history baseline', () => {
    expect(
      resolveAtlasBoundedMigrationCount({
        declaredVersions: [
          '20260712000000',
          '20260713120000',
          '20260714120000',
          '20260714130000',
          '20260715120000',
        ],
        appliedVersions: ['20260712000000', '20260714120000', '20260714130000'],
        targetVersion: '20260715120000',
        historyReconciliationVersion: '20260714130000',
      })
    ).toBe(1);
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
