import { type ConnectionOptions, Queue } from 'bullmq';

const connection: ConnectionOptions = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379', 10),
  password: process.env.REDIS_PASSWORD,
  maxRetriesPerRequest: null,
};

export const projectInitQueue = new Queue('project-init', { connection });
export const deploymentQueue = new Queue('deployment', { connection });

export type ProjectInitJobData = {
  projectId: string;
  mode: 'import' | 'create';
};

export type DeploymentJobData = {
  deploymentId: string;
  projectId: string;
  environmentId: string;
};

export async function addProjectInitJob(projectId: string, mode: 'import' | 'create') {
  return projectInitQueue.add('init', { projectId, mode });
}

export async function addDeploymentJob(
  deploymentId: string,
  projectId: string,
  environmentId: string
) {
  return deploymentQueue.add(
    'deploy',
    { deploymentId, projectId, environmentId },
    {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 5000,
      },
    }
  );
}

export async function closeQueues() {
  return Promise.all([projectInitQueue.close(), deploymentQueue.close()]);
}
