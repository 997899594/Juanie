import { describe, expect, it } from 'bun:test';
import {
  collapseRunsToLatestByLockKey,
  filterAttentionRuns,
  getAttentionStats,
  isAttentionMigrationRun,
  matchesAttentionFilter,
} from '@/lib/migrations/attention';

describe('migration attention helpers', () => {
  const runs = [
    { id: '1', status: 'awaiting_approval' },
    { id: '2', status: 'failed' },
    { id: '3', status: 'canceled' },
    { id: '4', status: 'success' },
  ];

  it('detects attention runs by status', () => {
    expect(isAttentionMigrationRun(runs[0])).toBe(true);
    expect(isAttentionMigrationRun(runs[3])).toBe(false);
  });

  it('matches filter states consistently', () => {
    expect(matchesAttentionFilter('awaiting_approval', 'all')).toBe(true);
    expect(matchesAttentionFilter('awaiting_approval', 'approval')).toBe(true);
    expect(matchesAttentionFilter('failed', 'approval')).toBe(false);
    expect(matchesAttentionFilter('failed', 'failed')).toBe(true);
  });

  it('filters attention runs', () => {
    expect(filterAttentionRuns(runs).map((run) => run.id)).toEqual(['1', '2']);
    expect(filterAttentionRuns(runs, 'approval').map((run) => run.id)).toEqual(['1']);
    expect(filterAttentionRuns(runs, 'canceled').map((run) => run.id)).toEqual(['3']);
  });

  it('builds stats from runs', () => {
    expect(getAttentionStats(runs)).toEqual({
      total: 2,
      approval: 1,
      failed: 1,
      canceled: 1,
      external: 0,
    });
  });

  it('collapses historical retries to the latest lockKey state', () => {
    const timeline = [
      {
        id: 'run-older-failed',
        lockKey: 'db-1:env-1',
        status: 'failed',
        createdAt: '2026-04-01T00:00:00.000Z',
      },
      {
        id: 'run-latest-failed',
        lockKey: 'db-1:env-1',
        status: 'failed',
        createdAt: '2026-04-03T00:00:00.000Z',
      },
      {
        id: 'run-success',
        lockKey: 'db-2:env-1',
        status: 'success',
        createdAt: '2026-04-02T00:00:00.000Z',
      },
    ];

    expect(collapseRunsToLatestByLockKey(timeline).map((run) => run.id)).toEqual([
      'run-latest-failed',
      'run-success',
    ]);
    expect(filterAttentionRuns(timeline).map((run) => run.id)).toEqual(['run-latest-failed']);
    expect(getAttentionStats(timeline)).toEqual({
      total: 1,
      approval: 0,
      external: 0,
      failed: 1,
      canceled: 0,
    });
  });

  it('treats a later success as resolved attention for the same lockKey', () => {
    const timeline = [
      {
        id: 'run-failed',
        lockKey: 'db-1:env-1',
        status: 'failed',
        createdAt: '2026-04-01T00:00:00.000Z',
      },
      {
        id: 'run-success',
        lockKey: 'db-1:env-1',
        status: 'success',
        createdAt: '2026-04-02T00:00:00.000Z',
      },
    ];

    expect(filterAttentionRuns(timeline)).toEqual([]);
    expect(getAttentionStats(timeline)).toEqual({
      total: 0,
      approval: 0,
      external: 0,
      failed: 0,
      canceled: 0,
    });
  });
});
