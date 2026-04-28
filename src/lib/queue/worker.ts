import { initK8sClient } from '@/lib/k8s';
import { logger } from '@/lib/logger';
import { createAITaskWorker } from './ai-task';
import { createDeploymentWorker } from './deployment';
import { createMigrationWorker, reconcileUnexpectedMigrationJobFailure } from './migration';
import { createProjectDeleteWorker } from './project-delete';
import { createProjectInitWorker } from './project-init';
import { createReleaseWorker, reconcileUnexpectedReleaseJobFailure } from './release';
import { startSchedulerRuntime } from './scheduler-runtime';
import { createSchemaRepairAtlasWorker } from './schema-repair-atlas';

// 启动时初始化 K8s 客户端（in-cluster ServiceAccount 或 KUBECONFIG）
initK8sClient();
const workerLogger = logger.child({ component: 'queue-worker' });

workerLogger.info('Starting Juanie workers');

const projectInitWorker = createProjectInitWorker();
const projectDeleteWorker = createProjectDeleteWorker();
const releaseWorker = createReleaseWorker();
const deploymentWorker = createDeploymentWorker();
const migrationWorker = createMigrationWorker();
const schemaRepairAtlasWorker = createSchemaRepairAtlasWorker();
const aiTaskWorker = createAITaskWorker();
const schedulerTasks =
  process.env.JUANIE_WORKER_RUN_SCHEDULER === 'true' ? startSchedulerRuntime() : [];

projectInitWorker.on('completed', (job) => {
  workerLogger.info('Project init job completed', { jobId: job.id, queue: 'project-init' });
});

projectInitWorker.on('failed', (job, err) => {
  workerLogger.error('Project init job failed', err, { jobId: job?.id, queue: 'project-init' });
});

projectDeleteWorker.on('completed', (job) => {
  workerLogger.info('Project delete job completed', { jobId: job.id, queue: 'project-delete' });
});

projectDeleteWorker.on('failed', (job, err) => {
  workerLogger.error('Project delete job failed', err, {
    jobId: job?.id,
    queue: 'project-delete',
  });
});

releaseWorker.on('completed', (job) => {
  workerLogger.info('Release job completed', { jobId: job.id, queue: 'release' });
});

releaseWorker.on('failed', (job, err) => {
  workerLogger.error('Release job failed', err, { jobId: job?.id, queue: 'release' });
  const releaseId = job?.data?.releaseId;
  if (!releaseId) {
    return;
  }

  void reconcileUnexpectedReleaseJobFailure(releaseId, err).catch((reconcileError) => {
    workerLogger.error('Failed to reconcile release job failure', reconcileError, {
      jobId: job?.id,
      queue: 'release',
      releaseId,
    });
  });
});

deploymentWorker.on('completed', (job) => {
  workerLogger.info('Deployment job completed', { jobId: job.id, queue: 'deployment' });
});

deploymentWorker.on('failed', (job, err) => {
  workerLogger.error('Deployment job failed', err, { jobId: job?.id, queue: 'deployment' });
});

migrationWorker.on('completed', (job) => {
  workerLogger.info('Migration job completed', { jobId: job.id, queue: 'migration' });
});

migrationWorker.on('failed', (job, err) => {
  workerLogger.error('Migration job failed', err, { jobId: job?.id, queue: 'migration' });
  const runId = job?.data?.runId;
  if (!runId) {
    return;
  }

  void reconcileUnexpectedMigrationJobFailure(runId, err).catch((reconcileError) => {
    workerLogger.error('Failed to reconcile migration job failure', reconcileError, {
      jobId: job?.id,
      queue: 'migration',
      runId,
    });
  });
});

schemaRepairAtlasWorker.on('completed', (job) => {
  workerLogger.info('Schema repair Atlas job completed', {
    jobId: job.id,
    queue: 'schema-repair-atlas',
  });
});

schemaRepairAtlasWorker.on('failed', (job, err) => {
  workerLogger.error('Schema repair Atlas job failed', err, {
    jobId: job?.id,
    queue: 'schema-repair-atlas',
  });
});

aiTaskWorker.on('completed', (job) => {
  workerLogger.info('AI task job completed', {
    jobId: job.id,
    queue: 'ai-task',
  });
});

aiTaskWorker.on('failed', (job, err) => {
  workerLogger.error('AI task job failed', err, {
    jobId: job?.id,
    queue: 'ai-task',
  });
});

process.on('SIGTERM', async () => {
  workerLogger.info('Shutting down workers', { signal: 'SIGTERM' });
  await Promise.all([
    projectInitWorker.close(),
    projectDeleteWorker.close(),
    releaseWorker.close(),
    deploymentWorker.close(),
    migrationWorker.close(),
    schemaRepairAtlasWorker.close(),
    aiTaskWorker.close(),
  ]);
  process.exit(0);
});

process.on('SIGINT', async () => {
  workerLogger.info('Shutting down workers', { signal: 'SIGINT' });
  await Promise.all([
    projectInitWorker.close(),
    projectDeleteWorker.close(),
    releaseWorker.close(),
    deploymentWorker.close(),
    migrationWorker.close(),
    schemaRepairAtlasWorker.close(),
    aiTaskWorker.close(),
  ]);
  process.exit(0);
});

workerLogger.info('Workers started successfully', {
  queues: [
    'project-init',
    'project-delete',
    'release',
    'deployment',
    'migration',
    'schema-repair-atlas',
    'ai-task',
  ],
  schedulerTasks,
});
