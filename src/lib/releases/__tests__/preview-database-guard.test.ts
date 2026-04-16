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
});
