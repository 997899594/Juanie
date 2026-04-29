import { describe, expect, it } from 'bun:test';
import {
  buildMigrationFilePreviewByRunId,
  type MigrationFilePreviewSnapshot,
  resolveMigrationPendingState,
} from '@/lib/migrations/file-preview';

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
});
