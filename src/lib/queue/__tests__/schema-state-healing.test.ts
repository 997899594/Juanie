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
    };

    expect(
      canAutoRetryFailedSourceBuildAfterSchemaHealing({
        environment,
        project,
        schemaStates: [
          {
            databaseId: 'db_1',
            status: 'pending_migrations',
            summary: '可通过正常发布补齐',
            hasLedger: true,
            hasUserTables: true,
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
            status: 'blocked',
            summary: '仍然失败',
            hasLedger: false,
            hasUserTables: false,
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
            status: 'aligned',
            summary: '一致',
            hasLedger: true,
            hasUserTables: true,
          },
        ],
      })
    ).toBe(false);
  });
});
