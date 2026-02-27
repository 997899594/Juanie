import { createDeploymentWorker } from './deployment';
import { createProjectInitWorker } from './project-init';

console.log('Starting Juanie workers...');

const projectInitWorker = createProjectInitWorker();
const deploymentWorker = createDeploymentWorker();

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

process.on('SIGTERM', async () => {
  console.log('Shutting down workers...');
  await Promise.all([projectInitWorker.close(), deploymentWorker.close()]);
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('Shutting down workers...');
  await Promise.all([projectInitWorker.close(), deploymentWorker.close()]);
  process.exit(0);
});

console.log('Workers started successfully');
console.log('  - Project init worker: listening to "project-init" queue');
console.log('  - Deployment worker: listening to "deployment" queue');
