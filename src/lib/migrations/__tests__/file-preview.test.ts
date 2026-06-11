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
  diffDatabaseSchemaAgainstDesiredSchema: async () => ({
    hasChanges: true,
    diffSql: 'ALTER TABLE notes ADD COLUMN title text;',
  }),
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

  it('treats stored execution plans as pending work', () => {
    const preview: MigrationFilePreviewSnapshot = {
      sourceLabel: 'Atlas schema diff',
      files: [],
      executionPlan: {
        path: 'atlas-schema-diff.sql',
        content: 'ALTER TABLE notes ADD COLUMN title text;',
        language: 'sql',
      },
      total: 0,
      declaredTotal: 0,
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

    const successPreview = previewByRunId.get('run-success');
    expect(successPreview?.sourceLabel).toBe('Desired schema');
    expect(successPreview?.files).toEqual([]);
    expect(successPreview?.total).toBe(0);
    expect(successPreview?.declaredTotal).toBe(1);
    expect(successPreview?.executedTotal).toBe(1);
    expect(successPreview?.truncated).toBe(false);
    expect(successPreview?.warning).toBe(null);

    const queuedPreview = previewByRunId.get('run-queued');
    expect(queuedPreview).toEqual({
      sourceLabel: 'Desired schema',
      files: ['desired-schema.sql'],
      fileDetails: undefined,
      executionPlan: null,
      total: 1,
      declaredTotal: 1,
      executedTotal: 0,
      truncated: false,
      warning: null,
    });
  });

  it('keeps historical details for completed run-status previews', async () => {
    const previewByRunId = await buildMigrationFilePreviewByRunId(
      [
        {
          id: 'run-success-with-details',
          projectId: 'project-1',
          specification: { tool: 'sql', migrationPath: 'migrations/history' },
          status: 'success',
          filePreview: {
            sourceLabel: 'SQL 目录',
            files: ['001_init.sql'],
            fileDetails: [
              {
                path: '001_init.sql',
                content: 'CREATE TABLE historical_notes (id uuid primary key);',
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
    const preview = previewByRunId.get('run-success-with-details');

    expect(preview?.files).toEqual(['001_init.sql']);
    expect(preview?.fileDetails).toEqual([
      {
        path: '001_init.sql',
        content: 'CREATE TABLE historical_notes (id uuid primary key);',
        truncated: false,
        language: 'sql',
      },
    ]);
    expect(preview?.total).toBe(0);
    expect(preview?.declaredTotal).toBe(1);
    expect(preview?.executedTotal).toBe(1);
  });

  it('keeps stored Atlas diff SQL for completed drizzle runs', async () => {
    const previewByRunId = await buildMigrationFilePreviewByRunId(
      [
        {
          id: 'run-drizzle-success-with-atlas-plan',
          projectId: 'project-1',
          specification: { tool: 'drizzle', sourceConfigPath: 'drizzle.config.mjs' },
          status: 'success',
          filePreview: {
            sourceLabel: 'Atlas schema diff',
            files: ['atlas-schema-diff.sql'],
            fileDetails: [
              {
                path: 'atlas-schema-diff.sql',
                content: 'ALTER TABLE notes ADD COLUMN title text;',
                truncated: false,
                language: 'sql',
              },
            ],
            executionPlan: {
              path: 'atlas-schema-diff.sql',
              content: 'ALTER TABLE notes ADD COLUMN title text;',
              language: 'sql',
            },
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
    const preview = previewByRunId.get('run-drizzle-success-with-atlas-plan');

    expect(preview?.files).toEqual(['atlas-schema-diff.sql']);
    expect(preview?.fileDetails).toEqual([
      {
        path: 'atlas-schema-diff.sql',
        content: 'ALTER TABLE notes ADD COLUMN title text;',
        truncated: false,
        language: 'sql',
      },
    ]);
    expect(preview?.executionPlan).toEqual({
      path: 'atlas-schema-diff.sql',
      content: 'ALTER TABLE notes ADD COLUMN title text;',
      language: 'sql',
    });
    expect(preview?.total).toBe(0);
    expect(preview?.declaredTotal).toBe(1);
    expect(preview?.executedTotal).toBe(1);
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
    expect(preview?.fileDetails).toBeUndefined();
    expect(preview?.total).toBe(0);
    expect(preview?.declaredTotal).toBe(1);
    expect(preview?.executedTotal).toBe(1);
  });

  it('does not expose full desired schema ddl from stored pending drizzle previews', async () => {
    const previewByRunId = await buildMigrationFilePreviewByRunId(
      [
        {
          id: 'run-drizzle-pending-with-stored-ddl',
          projectId: 'project-1',
          specification: { tool: 'drizzle' },
          status: 'awaiting_approval',
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
    const preview = previewByRunId.get('run-drizzle-pending-with-stored-ddl');

    expect(preview?.files).toEqual(['desired-schema.sql']);
    expect(preview?.fileDetails).toBeUndefined();
    expect(preview?.executionPlan).toBe(null);
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
    expect(preview?.total).toBe(0);
    expect(preview?.declaredTotal).toBe(1);
    expect(preview?.executedTotal).toBe(1);
    expect(preview?.warning).toBe(null);
    expect(drizzleExportCount).toBe(0);
  });

  it('shows Atlas diff SQL instead of full desired schema for live drizzle previews', async () => {
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

    expect(preview?.sourceLabel).toBe('Atlas schema diff');
    expect(preview?.total).toBe(1);
    expect(preview?.files).toEqual(['atlas-schema-diff.sql']);
    expect(preview?.fileDetails).toEqual([
      {
        path: 'atlas-schema-diff.sql',
        content: 'ALTER TABLE notes ADD COLUMN title text;',
        truncated: false,
        language: 'sql',
      },
    ]);
    expect(preview?.executionPlan).toEqual({
      path: 'atlas-schema-diff.sql',
      content: 'ALTER TABLE notes ADD COLUMN title text;',
      language: 'sql',
    });
    expect(drizzleExportCount).toBe(1);
  });

  it('does not rehydrate aligned drizzle previews into full desired schema details', async () => {
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
    expect(preview?.total).toBe(0);
    expect(preview?.declaredTotal).toBe(1);
    expect(preview?.executedTotal).toBe(1);
    expect(preview?.fileDetails).toBeUndefined();
    expect(drizzleExportCount).toBe(0);
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
