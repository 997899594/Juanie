import type { MigrationRunStatus } from '@/lib/db/schema';

export interface ReleaseMigrationPhaseRunProgress {
  id: string;
  status: MigrationRunStatus;
  createdAt: Date;
}

export type ReleaseMigrationPhaseNextAction =
  | {
      kind: 'running';
    }
  | {
      kind: 'start_run';
      runId: string;
    }
  | {
      kind: 'awaiting_approval';
      runId: string;
    }
  | {
      kind: 'awaiting_external_completion';
      runId: string;
    }
  | {
      kind: 'completed';
    }
  | {
      kind: 'blocked';
      runId: string;
      status: MigrationRunStatus;
    };

export function resolveMigrationPhaseNextAction(
  runs: ReleaseMigrationPhaseRunProgress[]
): ReleaseMigrationPhaseNextAction {
  const ordered = [...runs].sort(
    (left, right) => left.createdAt.getTime() - right.createdAt.getTime()
  );

  const active = ordered.find((run) => run.status === 'planning' || run.status === 'running');
  if (active) {
    return { kind: 'running' };
  }

  const queued = ordered.find((run) => run.status === 'queued');
  if (queued) {
    return { kind: 'start_run', runId: queued.id };
  }

  const awaitingApproval = ordered.find((run) => run.status === 'awaiting_approval');
  if (awaitingApproval) {
    return {
      kind: 'awaiting_approval',
      runId: awaitingApproval.id,
    };
  }

  const awaitingExternalCompletion = ordered.find(
    (run) => run.status === 'awaiting_external_completion'
  );
  if (awaitingExternalCompletion) {
    return {
      kind: 'awaiting_external_completion',
      runId: awaitingExternalCompletion.id,
    };
  }

  if (ordered.length === 0 || ordered.every((run) => run.status === 'success')) {
    return { kind: 'completed' };
  }

  const blocked = ordered.find((run) => run.status !== 'success');
  if (blocked) {
    return {
      kind: 'blocked',
      runId: blocked.id,
      status: blocked.status,
    };
  }

  return { kind: 'completed' };
}
