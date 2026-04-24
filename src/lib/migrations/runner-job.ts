import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { migrationRuns } from '@/lib/db/schema';
import { createJob, deleteJob, isK8sAvailable } from '@/lib/k8s';
import { appendMigrationRunLog, failMigrationRunWithoutThrow } from '@/lib/migrations/run-state';
import { resumeReleaseAfterMigrationProgress } from '@/lib/releases/orchestration';
import {
  buildSchemaRunnerJob,
  resolveSchemaRunnerImage,
} from '@/lib/schema-management/schema-runner-job';

function buildMigrationSchemaRunnerEnv(input: {
  runId: string;
  allowApprovalBypass: boolean;
}): Array<{
  name: string;
  value: string;
}> {
  return [
    {
      name: 'MIGRATION_RUN_ID',
      value: input.runId,
    },
    {
      name: 'MIGRATION_ALLOW_APPROVAL_BYPASS',
      value: input.allowApprovalBypass ? 'true' : 'false',
    },
  ];
}

export function buildMigrationSchemaRunnerJobName(runId: string): string {
  return `migration-run-${runId.slice(0, 8)}`;
}

export async function dispatchMigrationRunToSchemaRunner(input: {
  runId: string;
  allowApprovalBypass?: boolean;
  namespace?: string;
}): Promise<{
  dispatched: boolean;
  skipped?: boolean;
  reused?: boolean;
  jobName?: string;
}> {
  const namespace = input.namespace ?? process.env.JUANIE_NAMESPACE ?? 'juanie';
  const image = resolveSchemaRunnerImage();

  if (!isK8sAvailable()) {
    throw new Error('Migration execution requires Kubernetes connectivity');
  }

  if (!image) {
    throw new Error('SCHEMA_RUNNER_IMAGE_REPOSITORY and SCHEMA_RUNNER_IMAGE_TAG are required');
  }

  const run = await db.query.migrationRuns.findFirst({
    where: eq(migrationRuns.id, input.runId),
    columns: {
      id: true,
      status: true,
      jobName: true,
    },
  });

  if (!run) {
    throw new Error(`Migration run ${input.runId} not found`);
  }

  if (
    [
      'success',
      'failed',
      'canceled',
      'skipped',
      'awaiting_approval',
      'awaiting_external_completion',
    ].includes(run.status)
  ) {
    return {
      dispatched: false,
      skipped: true,
      jobName: run.jobName ?? undefined,
    };
  }

  if ((run.status === 'planning' || run.status === 'running') && run.jobName) {
    return {
      dispatched: false,
      reused: true,
      jobName: run.jobName,
    };
  }

  const jobName = run.jobName ?? buildMigrationSchemaRunnerJobName(run.id);
  const dispatchLog = `已提交 schema-runner 迁移任务 ${jobName}，等待独立 Job 执行。`;

  await db
    .update(migrationRuns)
    .set({
      status: 'planning',
      runnerType: 'schema_runner',
      jobName,
      finishedAt: null,
      durationMs: null,
      errorCode: null,
      errorMessage: null,
      updatedAt: new Date(),
    })
    .where(eq(migrationRuns.id, run.id));

  await appendMigrationRunLog(run.id, dispatchLog, {
    dedupeConsecutive: true,
  });

  try {
    await deleteJob(namespace, jobName).catch(() => undefined);
    await createJob(
      namespace,
      buildSchemaRunnerJob({
        namespace,
        jobName,
        image,
        mode: 'migration',
        labels: {
          'juanie.dev/migration-run-id': run.id,
        },
        env: buildMigrationSchemaRunnerEnv({
          runId: run.id,
          allowApprovalBypass: input.allowApprovalBypass ?? false,
        }),
      })
    );

    return {
      dispatched: true,
      jobName,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await failMigrationRunWithoutThrow(run.id, 'MIGRATION_JOB_DISPATCH_FAILED', message);
    await resumeReleaseAfterMigrationProgress(run.id);
    throw error;
  }
}
