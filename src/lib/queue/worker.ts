import { initK8sClient } from '@/lib/k8s';
import { logger } from '@/lib/logger';
import { createDeploymentWorker } from './deployment';
import { createMigrationWorker } from './migration';
import { createProjectDeleteWorker } from './project-delete';
import { createProjectInitWorker } from './project-init';
import { createReleaseWorker } from './release';
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

process.on('SIGTERM', async () => {
  workerLogger.info('Shutting down workers', { signal: 'SIGTERM' });
  await Promise.all([
    projectInitWorker.close(),
    projectDeleteWorker.close(),
    releaseWorker.close(),
    deploymentWorker.close(),
    migrationWorker.close(),
    schemaRepairAtlasWorker.close(),
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
  ],
});
