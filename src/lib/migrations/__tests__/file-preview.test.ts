import { describe, expect, it } from 'bun:test';
import {
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
});
