import type { MigrationRunStatus } from '@/lib/db/schema';

export interface ReleaseMigrationPhaseRunProgress {
  id: string;
  status: MigrationRunStatus;
  createdAt: Date;
  stageOrder?: number;
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
  const ordered = [...runs].sort((left, right) => {
    const stageDifference = (left.stageOrder ?? 0) - (right.stageOrder ?? 0);
    return stageDifference || left.createdAt.getTime() - right.createdAt.getTime();
  });

  const active = ordered.find((run) => run.status === 'planning' || run.status === 'running');
  if (active) {
    return { kind: 'running' };
  }

  const terminalCompletionStates: MigrationRunStatus[] = ['success', 'skipped'];
  const next = ordered.find((run) => !terminalCompletionStates.includes(run.status));

  if (!next) {
    return { kind: 'completed' };
  }

  if (next.status === 'queued') {
    return { kind: 'start_run', runId: next.id };
  }

  if (next.status === 'awaiting_approval') {
    return {
      kind: 'awaiting_approval',
      runId: next.id,
    };
  }

  if (next.status === 'awaiting_external_completion') {
    return {
      kind: 'awaiting_external_completion',
      runId: next.id,
    };
  }

  return {
    kind: 'blocked',
    runId: next.id,
    status: next.status,
  };
}
