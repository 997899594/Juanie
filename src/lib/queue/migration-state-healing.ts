import { Cron } from 'croner';
import { and, asc, eq, inArray, isNotNull } from 'drizzle-orm';
import { db } from '@/lib/db';
import { migrationRuns } from '@/lib/db/schema';
import { logger } from '@/lib/logger';
import { failMigrationRunWithoutThrow } from '@/lib/migrations/run-state';
import { resumeReleaseAfterMigrationProgress } from '@/lib/releases/orchestration';
import { getSchemaRunnerJobStatus } from '@/lib/schema-management/schema-runner-job';

const DEFAULT_MIGRATION_STATE_HEALING_SCHEDULE =
  process.env.MIGRATION_STATE_HEALING_SCHEDULE?.trim() || '*/2 * * * *';
const DEFAULT_MIGRATION_STATE_HEALING_BATCH_SIZE = parsePositiveInt(
  process.env.MIGRATION_STATE_HEALING_BATCH_SIZE,
  20
);
const DEFAULT_MIGRATION_STATE_HEALING_STALE_MINUTES = parsePositiveInt(
  process.env.MIGRATION_STATE_HEALING_STALE_MINUTES,
  30
);
const DEFAULT_MIGRATION_JOB_MISSING_GRACE_MS = parsePositiveInt(
  process.env.MIGRATION_JOB_MISSING_GRACE_MS,
  2 * 60 * 1000
);
const DEFAULT_MIGRATION_JOB_COMPLETION_GRACE_MS = parsePositiveInt(
  process.env.MIGRATION_JOB_COMPLETION_GRACE_MS,
  30 * 1000
);

const migrationStateHealingLogger = logger.child({ component: 'migration-state-healing' });

let migrationStateHealingRunning = false;

function parsePositiveInt(value: string | undefined, fallback: number): number {
  const parsed = Number.parseInt(value ?? '', 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export function shouldFailMissingSchemaRunnerJob(input: {
  updatedAt: Date;
  now?: Date;
  graceMs?: number;
}): boolean {
  const now = input.now ?? new Date();
  const graceMs = input.graceMs ?? DEFAULT_MIGRATION_JOB_MISSING_GRACE_MS;
  return input.updatedAt.getTime() <= now.getTime() - graceMs;
}

export function shouldFailCompletedSchemaRunnerJobWithoutStateUpdate(input: {
  updatedAt: Date;
  now?: Date;
  graceMs?: number;
}): boolean {
  const now = input.now ?? new Date();
  const graceMs = input.graceMs ?? DEFAULT_MIGRATION_JOB_COMPLETION_GRACE_MS;
  return input.updatedAt.getTime() <= now.getTime() - graceMs;
}

export function shouldFailStaleSchemaRunnerRun(input: {
  updatedAt: Date;
  now?: Date;
  staleMinutes?: number;
}): boolean {
  const now = input.now ?? new Date();
  const staleMinutes = input.staleMinutes ?? DEFAULT_MIGRATION_STATE_HEALING_STALE_MINUTES;
  return input.updatedAt.getTime() <= now.getTime() - staleMinutes * 60_000;
}

async function loadHealingCandidates(batchSize: number) {
  return db.query.migrationRuns.findMany({
    where: and(
      eq(migrationRuns.runnerType, 'schema_runner'),
      inArray(migrationRuns.status, ['planning', 'running']),
      isNotNull(migrationRuns.jobName)
    ),
    columns: {
      id: true,
      status: true,
      jobName: true,
      updatedAt: true,
    },
    orderBy: [asc(migrationRuns.updatedAt)],
    limit: batchSize,
  });
}

async function failHealingCandidate(input: {
  runId: string;
  errorCode: string;
  errorMessage: string;
}): Promise<void> {
  await failMigrationRunWithoutThrow(input.runId, input.errorCode, input.errorMessage);
  await resumeReleaseAfterMigrationProgress(input.runId);
}

export async function healMigrationRunnerState(options?: {
  now?: Date;
  batchSize?: number;
  staleMinutes?: number;
  missingGraceMs?: number;
  completionGraceMs?: number;
}): Promise<void> {
  const now = options?.now ?? new Date();
  const batchSize = options?.batchSize ?? DEFAULT_MIGRATION_STATE_HEALING_BATCH_SIZE;
  const staleMinutes = options?.staleMinutes ?? DEFAULT_MIGRATION_STATE_HEALING_STALE_MINUTES;
  const missingGraceMs = options?.missingGraceMs ?? DEFAULT_MIGRATION_JOB_MISSING_GRACE_MS;
  const completionGraceMs = options?.completionGraceMs ?? DEFAULT_MIGRATION_JOB_COMPLETION_GRACE_MS;

  const candidates = await loadHealingCandidates(batchSize);

  for (const candidate of candidates) {
    if (!candidate.jobName) {
      continue;
    }

    try {
      const job = await getSchemaRunnerJobStatus({
        jobName: candidate.jobName,
      });

      if (job.status === 'failed') {
        await failHealingCandidate({
          runId: candidate.id,
          errorCode: 'MIGRATION_JOB_FAILED',
          errorMessage: job.message ?? `Schema runner job ${candidate.jobName} 执行失败`,
        });
        migrationStateHealingLogger.warn('Reconciled failed migration schema-runner job', {
          runId: candidate.id,
          jobName: candidate.jobName,
        });
        continue;
      }

      if (
        job.status === 'missing' &&
        shouldFailMissingSchemaRunnerJob({
          updatedAt: candidate.updatedAt,
          now,
          graceMs: missingGraceMs,
        })
      ) {
        await failHealingCandidate({
          runId: candidate.id,
          errorCode: 'MIGRATION_JOB_MISSING',
          errorMessage: `Schema runner job ${candidate.jobName} 不存在或未被 Kubernetes 接受`,
        });
        migrationStateHealingLogger.warn('Reconciled missing migration schema-runner job', {
          runId: candidate.id,
          jobName: candidate.jobName,
        });
        continue;
      }

      if (
        job.status === 'succeeded' &&
        shouldFailCompletedSchemaRunnerJobWithoutStateUpdate({
          updatedAt: candidate.updatedAt,
          now,
          graceMs: completionGraceMs,
        })
      ) {
        await failHealingCandidate({
          runId: candidate.id,
          errorCode: 'MIGRATION_JOB_COMPLETED_WITHOUT_STATE_UPDATE',
          errorMessage: `Schema runner job ${candidate.jobName} 已完成，但 migration run 未写回终态`,
        });
        migrationStateHealingLogger.warn(
          'Reconciled completed migration schema-runner job without run state update',
          {
            runId: candidate.id,
            jobName: candidate.jobName,
          }
        );
        continue;
      }

      if (
        job.status === 'running' &&
        shouldFailStaleSchemaRunnerRun({
          updatedAt: candidate.updatedAt,
          now,
          staleMinutes,
        })
      ) {
        await failHealingCandidate({
          runId: candidate.id,
          errorCode: 'MIGRATION_RUN_STALE',
          errorMessage: `Schema runner job ${candidate.jobName} 长时间无进度更新，已按超时失败处理`,
        });
        migrationStateHealingLogger.warn('Reconciled stale migration schema-runner run', {
          runId: candidate.id,
          jobName: candidate.jobName,
        });
      }
    } catch (error) {
      migrationStateHealingLogger.error('Failed to heal migration runner state', error, {
        runId: candidate.id,
        jobName: candidate.jobName,
      });
    }
  }
}

export function startMigrationStateHealing(): void {
  if (migrationStateHealingRunning) {
    migrationStateHealingLogger.info('Migration state healing already running');
    return;
  }

  migrationStateHealingRunning = true;

  const runTick = async () => {
    try {
      await healMigrationRunnerState();
    } catch (error) {
      migrationStateHealingLogger.error('Migration state healing failed', error);
    }
  };

  void runTick();
  new Cron(DEFAULT_MIGRATION_STATE_HEALING_SCHEDULE, runTick);

  migrationStateHealingLogger.info('Migration state healing started', {
    schedule: DEFAULT_MIGRATION_STATE_HEALING_SCHEDULE,
    batchSize: DEFAULT_MIGRATION_STATE_HEALING_BATCH_SIZE,
    staleMinutes: DEFAULT_MIGRATION_STATE_HEALING_STALE_MINUTES,
    missingGraceMs: DEFAULT_MIGRATION_JOB_MISSING_GRACE_MS,
    completionGraceMs: DEFAULT_MIGRATION_JOB_COMPLETION_GRACE_MS,
  });
}
