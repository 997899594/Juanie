import { describe, expect, it } from 'bun:test';
import {
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
    expect(filterAttentionRuns(runs).map((run) => run.id)).toEqual(['1', '2', '3']);
    expect(filterAttentionRuns(runs, 'approval').map((run) => run.id)).toEqual(['1']);
  });

  it('builds stats from runs', () => {
    expect(getAttentionStats(runs)).toEqual({
      total: 3,
      approval: 1,
      failed: 1,
      canceled: 1,
    });
  });
});
