import { describe, expect, it } from 'bun:test';
import {
  inspectPreviewDatabaseGuard,
  previewDatabaseGuardMessage,
} from '@/lib/releases/preview-database-guard';

describe('preview database guard', () => {
  it('blocks preview releases that inherit databases and include migrations', () => {
    const guard = inspectPreviewDatabaseGuard({
      environment: {
        kind: 'preview',
        isPreview: true,
        databaseStrategy: 'inherit',
      },
      migrationSpecs: [
        {
          specification: {
            phase: 'preDeploy',
          },
        },
      ],
    });

    expect(guard.canCreate).toBe(false);
    expect(guard.blockingReason).toBe(previewDatabaseGuardMessage);
    expect(guard.customSignals).toEqual([
      {
        key: 'preview-database:inherit-migration-blocked',
        label: '预览库继承风险',
        tone: 'danger',
      },
    ]);
  });

  it('allows isolated preview databases to carry migrations', () => {
    const guard = inspectPreviewDatabaseGuard({
      environment: {
        kind: 'preview',
        isPreview: true,
        databaseStrategy: 'isolated_clone',
      },
      migrationSpecs: [
        {
          specification: {
            phase: 'postDeploy',
          },
        },
      ],
    });

    expect(guard.canCreate).toBe(true);
    expect(guard.blockingReason).toBe(null);
    expect(guard.customSignals).toEqual([]);
  });

  it('does not block inherited preview databases while schema checks are still pending', () => {
    const guard = inspectPreviewDatabaseGuard({
      environment: {
        kind: 'preview',
        isPreview: true,
        databaseStrategy: 'inherit',
      },
      migrationSpecs: [
        {
          database: {
            id: 'db-1',
            type: 'postgresql',
          },
          specification: {
            phase: 'preDeploy',
          },
        },
      ],
      schemaGate: {
        canCreate: true,
        checkedCount: 1,
        blockingCount: 0,
        blockingReason: null,
        summary: null,
        nextActionLabel: '等待 Schema 检查完成',
        customSignals: [
          {
            key: 'schema:refreshing',
            label: 'Schema 刷新中',
            tone: 'neutral',
          },
        ],
        states: [
          {
            databaseId: 'db-1',
            databaseName: 'primary',
            status: 'unknown',
            statusLabel: '待检查',
            summary: '尚未有当前版本的 schema 检查结果，已请求后台刷新。',
          },
        ],
        refresh: {
          requested: true,
          queuedCount: 1,
          runningCount: 0,
          unavailableCount: 0,
          failedCount: 0,
          missingCount: 1,
        },
      },
    });

    expect(guard.canCreate).toBe(true);
    expect(guard.blockingReason).toBe(null);
    expect(guard.customSignals).toEqual([]);
  });

  it('ignores runtime-only database specs when guarding inherited preview databases', () => {
    const guard = inspectPreviewDatabaseGuard({
      environment: {
        kind: 'preview',
        isPreview: true,
        databaseStrategy: 'inherit',
      },
      migrationSpecs: [
        {
          database: {
            id: 'db-redis',
            type: 'redis',
          },
          specification: {
            phase: 'preDeploy',
          },
        },
      ],
      schemaGate: {
        canCreate: true,
        checkedCount: 0,
        blockingCount: 0,
        blockingReason: null,
        summary: null,
        nextActionLabel: null,
        customSignals: [],
        states: [],
        refresh: {
          requested: false,
          queuedCount: 0,
          runningCount: 0,
          unavailableCount: 0,
          failedCount: 0,
          missingCount: 0,
        },
      },
    });

    expect(guard.canCreate).toBe(true);
    expect(guard.blockingReason).toBe(null);
    expect(guard.customSignals).toEqual([]);
  });
});
