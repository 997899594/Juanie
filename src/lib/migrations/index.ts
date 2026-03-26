import { and, eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { migrationRuns } from '@/lib/db/schema';
import {
  evaluateEnvironmentPolicy,
  evaluateMigrationPolicy,
  evaluateReleasePolicy,
} from '@/lib/policies/delivery';
import { buildPlatformSignalSnapshot } from '@/lib/signals/platform';
import { fetchMigrationFilesFromRepoPath } from './fetch';
import { resolveMigrationSpecifications } from './resolver';
import type {
  ExecuteMigrationRunOptions,
  MigrationExecutionPlan,
  ResolvedMigrationSpec,
} from './types';

export { resolveMigrationSpecifications } from './resolver';

function buildPlanEnvVars(spec: ResolvedMigrationSpec): string[] {
  const envVars: string[] = [];

  if (spec.database.connectionString) envVars.push('DATABASE_URL');
  if (spec.database.host) envVars.push('DB_HOST');
  if (spec.database.port) envVars.push('DB_PORT');
  if (spec.database.databaseName) envVars.push('DB_NAME');
  if (spec.database.username) envVars.push('DB_USER');
  if (spec.database.password) envVars.push('DB_PASSWORD');

  return envVars;
}

export async function createMigrationRun(
  spec: ResolvedMigrationSpec,
  input: {
    releaseId?: string | null;
    deploymentId?: string | null;
    triggeredBy: 'deploy' | 'manual' | 'api' | 'webhook';
    triggeredByUserId?: string | null;
    sourceCommitSha?: string | null;
    sourceCommitMessage?: string | null;
    runnerType?: 'k8s_job' | 'ci_job' | 'worker';
  }
) {
  const lockKey = `${spec.database.id}:${spec.environment.id}`;

  const [run] = await db
    .insert(migrationRuns)
    .values({
      projectId: spec.specification.projectId,
      serviceId: spec.service.id,
      environmentId: spec.environment.id,
      databaseId: spec.database.id,
      specificationId: spec.specification.id,
      releaseId: input.releaseId ?? null,
      deploymentId: input.deploymentId ?? null,
      triggeredBy: input.triggeredBy,
      triggeredByUserId: input.triggeredByUserId ?? null,
      sourceCommitSha: input.sourceCommitSha ?? null,
      sourceCommitMessage: input.sourceCommitMessage ?? null,
      status: 'queued',
      runnerType: input.runnerType ?? 'worker',
      lockKey,
    })
    .returning();

  return run;
}

export async function resolveAndRunMigrations(
  projectId: string,
  environmentId: string,
  phase: 'preDeploy' | 'postDeploy' | 'manual',
  input: {
    releaseId?: string | null;
    deploymentId?: string | null;
    triggeredBy: 'deploy' | 'manual' | 'api' | 'webhook';
    triggeredByUserId?: string | null;
    sourceRef?: string | null;
    sourceCommitSha?: string | null;
    sourceCommitMessage?: string | null;
    serviceIds?: string[];
    options?: ExecuteMigrationRunOptions;
  }
) {
  const runs = await resolveAndCreateMigrationRuns(projectId, environmentId, phase, input);
  return runs;
}

export async function resolveAndCreateMigrationRuns(
  projectId: string,
  environmentId: string,
  phase: 'preDeploy' | 'postDeploy' | 'manual',
  input: {
    releaseId?: string | null;
    deploymentId?: string | null;
    triggeredBy: 'deploy' | 'manual' | 'api' | 'webhook';
    triggeredByUserId?: string | null;
    sourceRef?: string | null;
    sourceCommitSha?: string | null;
    sourceCommitMessage?: string | null;
    serviceIds?: string[];
    options?: ExecuteMigrationRunOptions;
  }
) {
  const specs = await resolveMigrationSpecifications(projectId, environmentId, phase, {
    serviceIds: input.serviceIds,
    sourceRef: input.sourceRef,
    sourceCommitSha: input.sourceCommitSha,
  });
  const runs = [];

  for (const spec of specs.filter(
    (candidate) => candidate.specification.autoRun || phase === 'manual'
  )) {
    const run = await createMigrationRun(spec, {
      releaseId: input.releaseId,
      deploymentId: input.deploymentId,
      triggeredBy: input.triggeredBy,
      triggeredByUserId: input.triggeredByUserId,
      sourceCommitSha: input.sourceCommitSha,
      sourceCommitMessage: input.sourceCommitMessage,
      runnerType: input.options?.imageUrl ? 'k8s_job' : 'worker',
    });
    runs.push(run);
  }

  return runs;
}

export async function getMigrationRunById(runId: string) {
  return db.query.migrationRuns.findFirst({
    where: eq(migrationRuns.id, runId),
    with: {
      environment: true,
      database: true,
      service: true,
      specification: true,
      items: true,
    },
  });
}

export async function buildMigrationExecutionPlan(
  spec: ResolvedMigrationSpec,
  options: ExecuteMigrationRunOptions = {}
): Promise<MigrationExecutionPlan> {
  const confirmationValue = `${spec.database.name}/${spec.environment.name}`;
  const migrationPolicy = evaluateMigrationPolicy({
    environment: spec.environment,
    specification: spec.specification,
  });
  const environmentPolicy = evaluateEnvironmentPolicy(spec.environment);
  const releasePolicy = evaluateReleasePolicy({
    environment: spec.environment,
    migrationRuns: [
      {
        specification: spec.specification,
      },
    ],
  });
  const warnings: string[] = [...migrationPolicy.warnings];
  const migrationPath = spec.specification.migrationPath ?? `migrations/${spec.database.type}`;
  const imageUrl = options.imageUrl ?? null;
  const runnerType: 'k8s_job' | 'worker' = spec.specification.tool === 'sql' ? 'worker' : 'k8s_job';
  let canRun = spec.database.status === 'running';
  let blockingReason: string | null =
    spec.database.status === 'running'
      ? null
      : `数据库状态为 ${spec.database.status ?? '未知'}，只有 running 状态才能执行迁移`;
  let filePreviewError: string | null = null;
  let sqlFiles: Array<{ name: string }> = [];

  if (spec.specification.tool === 'sql') {
    try {
      const files = await fetchMigrationFilesFromRepoPath(
        spec.specification.projectId,
        migrationPath,
        spec.environment.branch || 'main'
      );
      sqlFiles = files.map((file) => ({ name: file.name }));
      if (sqlFiles.length === 0) {
        warnings.push(`在 ${migrationPath} 下没有找到迁移文件。`);
      }
    } catch (error) {
      canRun = false;
      filePreviewError = error instanceof Error ? error.message : String(error);
      blockingReason = `无法从 ${migrationPath} 读取迁移文件：${filePreviewError}`;
    }
  } else if (!imageUrl) {
    canRun = false;
    blockingReason = '命令式迁移需要最近一次可用的部署镜像。';
  }

  return {
    confirmationValue,
    canRun,
    blockingReason,
    filePreviewError,
    warnings,
    platformSignals: buildPlatformSignalSnapshot({
      environmentPolicySignals: environmentPolicy.signals,
      environmentPolicySignal: environmentPolicy.primarySignal,
      releasePolicySignals: releasePolicy.signals,
      releasePolicySignal: releasePolicy.primarySignal,
      migrationPolicySignals: migrationPolicy.signals,
      migrationPolicySignal: migrationPolicy.primarySignal,
    }),
    environmentPolicy,
    migrationPolicy,
    releasePolicy,
    runnerType,
    imageUrl,
    database: {
      id: spec.database.id,
      name: spec.database.name,
      type: spec.database.type,
      status: spec.database.status ?? null,
    },
    service: {
      id: spec.service.id,
      name: spec.service.name,
    },
    environment: {
      id: spec.environment.id,
      name: spec.environment.name,
      branch: spec.environment.branch ?? null,
      isProduction: spec.environment.isProduction,
    },
    specification: {
      id: spec.specification.id,
      tool: spec.specification.tool,
      phase: spec.specification.phase,
      workingDirectory: spec.specification.workingDirectory,
      migrationPath: spec.specification.migrationPath ?? null,
      command: spec.specification.command,
      compatibility: spec.specification.compatibility,
      approvalPolicy: spec.specification.approvalPolicy,
      lockStrategy: spec.specification.lockStrategy,
      autoRun: spec.specification.autoRun,
    },
    resolution: spec.resolution,
    envVars: buildPlanEnvVars(spec),
    sqlFiles,
  };
}

export async function getMigrationRunsForService(
  projectId: string,
  serviceId: string,
  environmentId?: string
) {
  return db.query.migrationRuns.findMany({
    where: environmentId
      ? and(
          eq(migrationRuns.projectId, projectId),
          eq(migrationRuns.serviceId, serviceId),
          eq(migrationRuns.environmentId, environmentId)
        )
      : and(eq(migrationRuns.projectId, projectId), eq(migrationRuns.serviceId, serviceId)),
    with: {
      environment: true,
      database: true,
      specification: true,
      items: true,
    },
    orderBy: (run, { desc }) => [desc(run.createdAt)],
  });
}
