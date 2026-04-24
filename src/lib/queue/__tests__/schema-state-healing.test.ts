import { describe, expect, it } from 'bun:test';
import {
  canAutoRetryFailedSourceBuildAfterSchemaHealing,
  isRetryableBlockedSchemaState,
} from '@/lib/queue/schema-state-healing';

describe('schema state healing', () => {
  it('treats stale blocked relational schema states as healing candidates', () => {
    expect(
      isRetryableBlockedSchemaState({
        status: 'blocked',
        databaseType: 'postgresql',
        lastInspectedAt: new Date('2026-04-24T04:00:00.000Z'),
        now: new Date('2026-04-24T04:20:00.000Z'),
        staleMinutes: 10,
      })
    ).toBe(true);

    expect(
      isRetryableBlockedSchemaState({
        status: 'blocked',
        databaseType: 'mongodb',
        lastInspectedAt: new Date('2026-04-24T04:00:00.000Z'),
        now: new Date('2026-04-24T04:20:00.000Z'),
        staleMinutes: 10,
      })
    ).toBe(false);

    expect(
      isRetryableBlockedSchemaState({
        status: 'pending_migrations',
        databaseType: 'postgresql',
        lastInspectedAt: new Date('2026-04-24T04:00:00.000Z'),
        now: new Date('2026-04-24T04:20:00.000Z'),
        staleMinutes: 10,
      })
    ).toBe(false);
  });

  it('auto retries failed source builds only after environment schema blocking is cleared', () => {
    const project = {
      id: 'project_1',
      teamId: 'team_1',
      status: 'active',
      repository: {
        providerId: 'provider_1',
        fullName: '997899594/nexusnote',
      },
    };
    const environment = {
      id: 'env_1',
      name: 'staging',
      previewBuildStatus: 'failed',
      previewBuildSourceRef: 'refs/heads/main',
      previewBuildSourceCommitSha: 'abc123',
      previewBuildStartedAt: new Date('2026-04-24T03:12:47.000Z'),
    };

    expect(
      canAutoRetryFailedSourceBuildAfterSchemaHealing({
        environment,
        project,
        schemaStates: [
          {
            databaseId: 'db_1',
            databaseName: 'primary',
            databaseType: 'postgresql',
            status: 'pending_migrations',
            summary: '可通过正常发布补齐',
            hasLedger: true,
            hasUserTables: true,
            lastInspectedAt: new Date('2026-04-24T05:08:13.000Z'),
          },
        ],
      })
    ).toBe(true);

    expect(
      canAutoRetryFailedSourceBuildAfterSchemaHealing({
        environment,
        project,
        schemaStates: [
          {
            databaseId: 'db_1',
            databaseName: 'primary',
            databaseType: 'postgresql',
            status: 'blocked',
            summary: '仍然失败',
            hasLedger: false,
            hasUserTables: false,
            lastInspectedAt: new Date('2026-04-24T05:08:13.000Z'),
          },
        ],
      })
    ).toBe(false);

    expect(
      canAutoRetryFailedSourceBuildAfterSchemaHealing({
        environment: {
          ...environment,
          previewBuildSourceCommitSha: null,
        },
        project,
        schemaStates: [
          {
            databaseId: 'db_1',
            databaseName: 'primary',
            databaseType: 'postgresql',
            status: 'aligned',
            summary: '一致',
            hasLedger: true,
            hasUserTables: true,
            lastInspectedAt: new Date('2026-04-24T05:08:13.000Z'),
          },
        ],
      })
    ).toBe(false);

    expect(
      canAutoRetryFailedSourceBuildAfterSchemaHealing({
        environment,
        project,
        schemaStates: [
          {
            databaseId: 'db_1',
            databaseName: 'primary',
            databaseType: 'postgresql',
            status: 'pending_migrations',
            summary: 'schema 已恢复',
            hasLedger: true,
            hasUserTables: true,
            lastInspectedAt: new Date('2026-04-24T03:00:00.000Z'),
          },
        ],
      })
    ).toBe(false);
  });
});
