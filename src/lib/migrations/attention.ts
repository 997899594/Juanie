export const attentionMigrationStatuses = ['awaiting_approval', 'failed', 'canceled'] as const;

export type AttentionMigrationStatus = (typeof attentionMigrationStatuses)[number];
export type AttentionFilterState = 'all' | 'approval' | 'failed' | 'canceled';

interface MigrationRunLike {
  status: string;
}

export function isAttentionMigrationStatus(status: string): status is AttentionMigrationStatus {
  return attentionMigrationStatuses.includes(status as AttentionMigrationStatus);
}

export function isAttentionMigrationRun<T extends MigrationRunLike>(run: T): boolean {
  return isAttentionMigrationStatus(run.status);
}

export function matchesAttentionFilter(status: string, filterState: AttentionFilterState): boolean {
  if (filterState === 'all') {
    return isAttentionMigrationStatus(status);
  }

  if (filterState === 'approval') {
    return status === 'awaiting_approval';
  }

  return status === filterState;
}

export function filterAttentionRuns<T extends MigrationRunLike>(
  runs: T[],
  filterState: AttentionFilterState = 'all'
): T[] {
  return runs.filter((run) => matchesAttentionFilter(run.status, filterState));
}

export function getAttentionStats<T extends MigrationRunLike>(
  runs: T[]
): {
  total: number;
  approval: number;
  failed: number;
  canceled: number;
} {
  return {
    total: runs.filter((run) => isAttentionMigrationRun(run)).length,
    approval: runs.filter((run) => run.status === 'awaiting_approval').length,
    failed: runs.filter((run) => run.status === 'failed').length,
    canceled: runs.filter((run) => run.status === 'canceled').length,
  };
}
