import { type ConnectionOptions, Queue } from 'bullmq';

function getConnection(): ConnectionOptions {
  return {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
    password: process.env.REDIS_PASSWORD,
    maxRetriesPerRequest: null,
  };
}

let _projectInitQueue: Queue | null = null;
let _deploymentQueue: Queue | null = null;

export function getProjectInitQueue(): Queue {
  if (!_projectInitQueue) {
    _projectInitQueue = new Queue('project-init', { connection: getConnection() });
  }
  return _projectInitQueue;
}

export function getDeploymentQueue(): Queue {
  if (!_deploymentQueue) {
    _deploymentQueue = new Queue('deployment', { connection: getConnection() });
  }
  return _deploymentQueue;
}

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
  return getProjectInitQueue().add('init', { projectId, mode });
}

export async function addDeploymentJob(
  deploymentId: string,
  projectId: string,
  environmentId: string
) {
  return getDeploymentQueue().add(
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
  const promises: Promise<void>[] = [];
  if (_projectInitQueue) promises.push(_projectInitQueue.close());
  if (_deploymentQueue) promises.push(_deploymentQueue.close());
  return Promise.all(promises);
}
