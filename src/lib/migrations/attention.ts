export const attentionMigrationStatuses = [
  'awaiting_approval',
  'awaiting_external_completion',
  'failed',
] as const;

export const historicalAttentionMigrationStatuses = [
  ...attentionMigrationStatuses,
  'canceled',
] as const;

export type AttentionMigrationStatus = (typeof attentionMigrationStatuses)[number];
export type AttentionFilterState = 'all' | 'approval' | 'external' | 'failed' | 'canceled';

interface MigrationRunLike {
  id?: string;
  lockKey?: string | null;
  status: string;
  createdAt?: Date | string | null;
  updatedAt?: Date | string | null;
}

function getRunTimestamp(run: MigrationRunLike): number {
  const candidate = run.createdAt ?? run.updatedAt;
  if (!candidate) {
    return Number.NEGATIVE_INFINITY;
  }

  const value = new Date(candidate).getTime();
  return Number.isFinite(value) ? value : Number.NEGATIVE_INFINITY;
}

function getRunGroupingKey(run: MigrationRunLike, index: number): string {
  if (run.lockKey && run.lockKey.trim().length > 0) {
    return run.lockKey;
  }

  if (run.id && run.id.trim().length > 0) {
    return run.id;
  }

  return `__attention_fallback_${index}`;
}

export function collapseRunsToLatestByLockKey<T extends MigrationRunLike>(runs: T[]): T[] {
  const indexedRuns = runs.map((run, index) => ({ run, index }));
  indexedRuns.sort((left, right) => {
    const timestampDelta = getRunTimestamp(right.run) - getRunTimestamp(left.run);
    if (timestampDelta !== 0) {
      return timestampDelta;
    }

    return left.index - right.index;
  });

  const latestRuns: T[] = [];
  const seenKeys = new Set<string>();

  for (const { run, index } of indexedRuns) {
    const key = getRunGroupingKey(run, index);
    if (seenKeys.has(key)) {
      continue;
    }

    seenKeys.add(key);
    latestRuns.push(run);
  }

  return latestRuns;
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

  if (filterState === 'external') {
    return status === 'awaiting_external_completion';
  }

  return status === filterState;
}

export function filterAttentionRuns<T extends MigrationRunLike>(
  runs: T[],
  filterState: AttentionFilterState = 'all'
): T[] {
  return collapseRunsToLatestByLockKey(runs).filter((run) =>
    matchesAttentionFilter(run.status, filterState)
  );
}

export function getAttentionStats<T extends MigrationRunLike>(
  runs: T[]
): {
  total: number;
  approval: number;
  external: number;
  failed: number;
  canceled: number;
} {
  const latestRuns = collapseRunsToLatestByLockKey(runs);

  return {
    total: latestRuns.filter((run) => isAttentionMigrationRun(run)).length,
    approval: latestRuns.filter((run) => run.status === 'awaiting_approval').length,
    external: latestRuns.filter((run) => run.status === 'awaiting_external_completion').length,
    failed: latestRuns.filter((run) => run.status === 'failed').length,
    canceled: latestRuns.filter((run) => run.status === 'canceled').length,
  };
}
