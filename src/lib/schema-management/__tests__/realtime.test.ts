import { describe, expect, it } from 'bun:test';
import {
  buildSchemaRepairRealtimeStateIndex,
  buildSchemaRepairRealtimeStateKey,
} from '@/lib/schema-management/realtime';

describe('schema repair realtime', () => {
  it('builds different state keys when review state changes', () => {
    const base = {
      id: 'db-1',
      schemaState: {
        status: 'drifted' as const,
        summary: 'drift detected',
        expectedVersion: '0002_add_users',
        actualVersion: '0001_init',
        lastInspectedAt: '2026-04-22T10:00:00.000Z',
      },
      latestRepairPlan: {
        id: 'plan-1',
        kind: 'repair_pr_required' as const,
        status: 'review_opened' as const,
        reviewState: 'open' as const,
        atlasExecutionStatus: 'idle' as const,
        atlasExecutionStartedAt: null,
        atlasExecutionFinishedAt: null,
        errorMessage: null,
      },
      latestAtlasRun: null,
    };

    const openKey = buildSchemaRepairRealtimeStateKey(base);
    const mergedKey = buildSchemaRepairRealtimeStateKey({
      ...base,
      latestRepairPlan: {
        ...base.latestRepairPlan,
        reviewState: 'merged',
      },
    });

    expect(openKey).not.toBe(mergedKey);
  });

  it('indexes current environment database states by database id', () => {
    const index = buildSchemaRepairRealtimeStateIndex([
      {
        databases: [
          {
            id: 'db-1',
            schemaState: null,
            latestRepairPlan: null,
            latestAtlasRun: null,
          },
          {
            id: 'db-2',
            schemaState: {
              status: 'pending_migrations',
              summary: 'pending',
              expectedVersion: '0002',
              actualVersion: '0001',
              lastInspectedAt: '2026-04-22T10:01:00.000Z',
            },
            latestRepairPlan: null,
            latestAtlasRun: null,
          },
        ],
      },
    ]);

    expect(Object.keys(index)).toEqual(['db-1', 'db-2']);
    expect(index['db-1']).toContain('db-1');
    expect(index['db-2']).toContain('pending_migrations');
  });
});
