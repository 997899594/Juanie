import { initK8sClient } from '@/lib/k8s';
import { createDeploymentWorker } from './deployment';
import { startDriftDetector } from './drift-detector';
import { createMigrationWorker } from './migration';
import { createProjectInitWorker } from './project-init';

// 启动时初始化 K8s 客户端（in-cluster ServiceAccount 或 KUBECONFIG）
initK8sClient();

console.log('Starting Juanie workers...');

const projectInitWorker = createProjectInitWorker();
const deploymentWorker = createDeploymentWorker();
const migrationWorker = createMigrationWorker();

projectInitWorker.on('completed', (job) => {
  console.log(`Project init job ${job.id} completed`);
});

projectInitWorker.on('failed', (job, err) => {
  console.error(`Project init job ${job?.id} failed:`, err.message);
});

deploymentWorker.on('completed', (job) => {
  console.log(`Deployment job ${job.id} completed`);
});

deploymentWorker.on('failed', (job, err) => {
  console.error(`Deployment job ${job?.id} failed:`, err.message);
});

migrationWorker.on('completed', (job) => {
  console.log(`Migration job ${job.id} completed`);
});

migrationWorker.on('failed', (job, err) => {
  console.error(`Migration job ${job?.id} failed:`, err.message);
});

process.on('SIGTERM', async () => {
  console.log('Shutting down workers...');
  await Promise.all([projectInitWorker.close(), deploymentWorker.close(), migrationWorker.close()]);
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('Shutting down workers...');
  await Promise.all([projectInitWorker.close(), deploymentWorker.close(), migrationWorker.close()]);
  process.exit(0);
});

console.log('Workers started successfully');
console.log('  - Project init worker: listening to "project-init" queue');
console.log('  - Deployment worker: listening to "deployment" queue');
console.log('  - Migration worker: listening to "migration" queue');

// 启动漂移检测
if (process.env.ENABLE_DRIFT_DETECTOR !== 'false') {
  startDriftDetector();
}
