import { describe, expect, it, mock } from 'bun:test';
import {
  buildMigrationFilePreviewByRunId,
  type MigrationFilePreviewSnapshot,
  resolveMigrationPendingState,
} from '@/lib/migrations/file-preview';

let drizzleExportCount = 0;
const migrationFilesByPath = new Map<
  string,
  Array<{
    name: string;
    content: string;
  }>
>();

mock.module('@/lib/migrations/fetch', () => ({
  fetchMigrationFilesFromRepoPath: async (_projectId: string, path: string) =>
    migrationFilesByPath.get(path) ?? [],
  listRepositoryDirectoryFromRepoPath: async () => [],
  readRepositoryFileFromRepoPath: async () => null,
}));

mock.module('@/lib/migrations/desired-schema', () => ({
  exportDesiredSchemaFromRepository: async () => {
    drizzleExportCount += 1;
    return {
      schemaSql: 'CREATE TABLE notes (id uuid primary key);',
      schemaFileUrl: 'file:///tmp/desired-schema.sql',
      sourceConfigPath: 'drizzle.config.mjs',
      cleanup: async () => {},
    };
  },
}));

mock.module('@/lib/migrations/atlas', () => ({
  diffDatabaseSchemaAgainstDesiredSchema: async () => ({ hasChanges: false, diffSql: '' }),
  extractAtlasMigrationVersion: (fileName: string) => fileName.match(/^(\d+)/)?.[1] ?? null,
  getAppliedAtlasVersions: async () => [],
  isAtlasDatabaseTarget: (database: { type: string }) =>
    database.type === 'postgresql' || database.type === 'mysql',
}));

describe('migration file preview pending state', () => {
  it('treats missing previews as unknown', () => {
    expect(resolveMigrationPendingState(null)).toBe('unknown');
  });

  it('treats empty pending previews as no work', () => {
    const preview: MigrationFilePreviewSnapshot = {
      sourceLabel: 'Desired schema',
      files: [],
      total: 0,
      declaredTotal: 1,
      executedTotal: 1,
      truncated: false,
      warning: null,
    };

    expect(resolveMigrationPendingState(preview)).toBe('none');
  });

  it('treats degraded empty previews as unknown', () => {
    const preview: MigrationFilePreviewSnapshot = {
      sourceLabel: '迁移目录',
      files: [],
      total: 0,
      declaredTotal: 0,
      executedTotal: 0,
      truncated: false,
      warning: '读取迁移目录超时，已降级为仅显示命令。',
    };

    expect(resolveMigrationPendingState(preview)).toBe('unknown');
  });

  it('treats non-empty pending previews as pending work', () => {
    const preview: MigrationFilePreviewSnapshot = {
      sourceLabel: 'SQL 目录',
      files: ['001_init.sql'],
      total: 1,
      declaredTotal: 1,
      executedTotal: 0,
      truncated: false,
      warning: null,
    };

    expect(resolveMigrationPendingState(preview)).toBe('pending');
  });

  it('uses persisted run status for read-model drizzle previews', async () => {
    const previewByRunId = await buildMigrationFilePreviewByRunId(
      [
        {
          id: 'run-success',
          projectId: 'project-1',
          specification: { tool: 'drizzle' },
          status: 'success',
        },
        {
          id: 'run-queued',
          projectId: 'project-1',
          specification: { tool: 'drizzle' },
          status: 'queued',
        },
      ],
      { executionStateMode: 'run_status' }
    );

    expect(previewByRunId.get('run-success')).toEqual({
      sourceLabel: 'Desired schema',
      files: [],
      total: 0,
      declaredTotal: 1,
      executedTotal: 1,
      truncated: false,
      warning: null,
    });
    expect(previewByRunId.get('run-queued')).toEqual({
      sourceLabel: 'Desired schema',
      files: ['desired-schema.sql'],
      total: 1,
      declaredTotal: 1,
      executedTotal: 0,
      truncated: false,
      warning: null,
    });
  });

  it('keeps historical details for completed run-status previews', async () => {
    migrationFilesByPath.set('migrations/history', [
      {
        name: '001_init.sql',
        content: 'CREATE TABLE historical_notes (id uuid primary key);',
      },
    ]);

    const previewByRunId = await buildMigrationFilePreviewByRunId(
      [
        {
          id: 'run-success-with-details',
          projectId: 'project-1',
          specification: { tool: 'sql', migrationPath: 'migrations/history' },
          status: 'success',
        },
      ],
      { executionStateMode: 'run_status', forceRefresh: true, includeFileDetails: true }
    );
    const preview = previewByRunId.get('run-success-with-details');

    expect(preview?.files).toEqual([]);
    expect(preview?.total).toBe(0);
    expect(preview?.historyFiles).toEqual(['001_init.sql']);
    expect(preview?.historyFileDetails).toEqual([
      {
        path: '001_init.sql',
        content: 'CREATE TABLE historical_notes (id uuid primary key);',
        truncated: false,
        language: 'sql',
      },
    ]);
  });

  it('uses stored historical drizzle details without re-exporting desired schema', async () => {
    const previewByRunId = await buildMigrationFilePreviewByRunId(
      [
        {
          id: 'run-drizzle-success-with-snapshot',
          projectId: 'project-1',
          specification: { tool: 'drizzle' },
          status: 'success',
          filePreview: {
            sourceLabel: 'Desired schema',
            files: ['desired-schema.sql'],
            fileDetails: [
              {
                path: 'desired-schema.sql',
                content: 'CREATE TABLE notes (id uuid primary key);',
                truncated: false,
                language: 'sql',
              },
            ],
            total: 1,
            declaredTotal: 1,
            executedTotal: 0,
            truncated: false,
            warning: null,
          },
        },
      ],
      { executionStateMode: 'run_status', forceRefresh: true, includeFileDetails: true }
    );
    const preview = previewByRunId.get('run-drizzle-success-with-snapshot');

    expect(preview?.files).toEqual([]);
    expect(preview?.historyFiles).toEqual(['desired-schema.sql']);
    expect(preview?.historyFileDetails).toEqual([
      {
        path: 'desired-schema.sql',
        content: 'CREATE TABLE notes (id uuid primary key);',
        truncated: false,
        language: 'sql',
      },
    ]);
  });

  it('does not generate historical drizzle details when no stored snapshot exists', async () => {
    drizzleExportCount = 0;
    const previewByRunId = await buildMigrationFilePreviewByRunId(
      [
        {
          id: 'run-drizzle-success-without-snapshot',
          projectId: 'project-1',
          specification: { tool: 'drizzle' },
          status: 'success',
          database: {
            type: 'postgresql',
            connectionString: 'postgres://example.invalid/db',
          },
        },
      ],
      { executionStateMode: 'run_status', forceRefresh: true, includeFileDetails: true }
    );
    const preview = previewByRunId.get('run-drizzle-success-without-snapshot');

    expect(preview?.files).toEqual([]);
    expect(preview?.historyFiles).toEqual(['desired-schema.sql']);
    expect(preview?.historyFileDetails).toBeUndefined();
    expect(preview?.warning).toBe(null);
    expect(drizzleExportCount).toBe(0);
  });

  it('keeps desired schema details for aligned live drizzle previews', async () => {
    drizzleExportCount = 0;
    const previewByRunId = await buildMigrationFilePreviewByRunId(
      [
        {
          id: 'run-drizzle-live-aligned',
          projectId: 'project-1',
          specification: { tool: 'drizzle', sourceConfigPath: 'drizzle.config.mjs' },
          status: 'queued',
          database: {
            id: 'database-1',
            type: 'postgresql',
            connectionString: 'postgres://example.invalid/db',
          },
        },
      ],
      { forceRefresh: true, includeFileDetails: true }
    );
    const preview = previewByRunId.get('run-drizzle-live-aligned');

    expect(preview?.total).toBe(0);
    expect(preview?.files).toEqual([]);
    expect(preview?.historyFiles).toEqual(['desired-schema.sql']);
    expect(preview?.historyFileDetails).toEqual([
      {
        path: 'desired-schema.sql',
        content: 'CREATE TABLE notes (id uuid primary key);',
        truncated: false,
        language: 'sql',
      },
    ]);
    expect(drizzleExportCount).toBe(1);
  });

  it('rehydrates stored aligned drizzle previews that were saved without details', async () => {
    drizzleExportCount = 0;

    const previewByRunId = await buildMigrationFilePreviewByRunId(
      [
        {
          id: 'run-drizzle-success-with-empty-snapshot',
          projectId: 'project-1',
          specification: { tool: 'drizzle', sourceConfigPath: 'drizzle.config.mjs' },
          status: 'success',
          filePreview: {
            sourceLabel: 'Desired schema',
            files: [],
            total: 0,
            declaredTotal: 1,
            executedTotal: 1,
            truncated: false,
            warning: null,
          },
          database: {
            id: 'database-1',
            type: 'postgresql',
            connectionString: 'postgres://example.invalid/db',
          },
        },
      ],
      { executionStateMode: 'run_status', forceRefresh: true, includeFileDetails: true }
    );
    const preview = previewByRunId.get('run-drizzle-success-with-empty-snapshot');

    expect(preview?.total).toBe(0);
    expect(preview?.files).toEqual([]);
    expect(preview?.historyFiles).toEqual(['desired-schema.sql']);
    expect(preview?.historyFileDetails).toEqual([
      {
        path: 'desired-schema.sql',
        content: 'CREATE TABLE notes (id uuid primary key);',
        truncated: false,
        language: 'sql',
      },
    ]);
    expect(drizzleExportCount).toBe(1);
  });

  it('attaches content details only for pending preview files', async () => {
    migrationFilesByPath.set('migrations/postgresql', [
      {
        name: '001_init.sql',
        content: 'CREATE TABLE notes (id uuid primary key);',
      },
      {
        name: '002_done.sql',
        content: 'ALTER TABLE notes ADD COLUMN title text;',
      },
    ]);

    const previewByRunId = await buildMigrationFilePreviewByRunId(
      [
        {
          id: 'run-sql',
          projectId: 'project-1',
          specification: { tool: 'sql', migrationPath: 'migrations/postgresql' },
          status: 'queued',
        },
      ],
      {
        executionStateMode: 'run_status',
        forceRefresh: true,
        includeFileDetails: true,
      }
    );
    const preview = previewByRunId.get('run-sql');

    expect(preview?.files).toEqual(['001_init.sql', '002_done.sql']);
    expect(preview?.fileDetails).toEqual([
      {
        path: '001_init.sql',
        content: 'CREATE TABLE notes (id uuid primary key);',
        truncated: false,
        language: 'sql',
      },
      {
        path: '002_done.sql',
        content: 'ALTER TABLE notes ADD COLUMN title text;',
        truncated: false,
        language: 'sql',
      },
    ]);
  });

  it('truncates long migration file details for approval previews', async () => {
    migrationFilesByPath.set('migrations/big', [
      {
        name: 'big.sql',
        content: 'x'.repeat(20_000),
      },
    ]);

    const previewByRunId = await buildMigrationFilePreviewByRunId(
      [
        {
          id: 'run-big',
          projectId: 'project-1',
          specification: { tool: 'atlas', migrationPath: 'migrations/big' },
          status: 'queued',
        },
      ],
      {
        executionStateMode: 'run_status',
        forceRefresh: true,
        includeFileDetails: true,
      }
    );
    const preview = previewByRunId.get('run-big');

    expect(preview?.fileDetails?.[0]?.path).toBe('big.sql');
    expect(preview?.fileDetails?.[0]?.language).toBe('sql');
    expect(preview?.fileDetails?.[0]?.truncated).toBe(true);
    expect((preview?.fileDetails?.[0]?.content.length ?? 20_000) < 20_000).toBe(true);
  });
});
