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
let _releaseQueue: Queue | null = null;
let _deploymentQueue: Queue | null = null;
let _migrationQueue: Queue | null = null;

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

export function getReleaseQueue(): Queue {
  if (!_releaseQueue) {
    _releaseQueue = new Queue('release', { connection: getConnection() });
  }
  return _releaseQueue;
}

export function getMigrationQueue(): Queue {
  if (!_migrationQueue) {
    _migrationQueue = new Queue('migration', { connection: getConnection() });
  }
  return _migrationQueue;
}

export type ProjectInitJobData = {
  projectId: string;
  mode: 'import' | 'create';
  template?: string;
};

export type DeploymentJobData = {
  deploymentId: string;
  projectId: string;
  environmentId: string;
};

export type ReleaseJobData = {
  releaseId: string;
};

export type MigrationJobData = {
  runId: string;
  imageUrl?: string | null;
  allowApprovalBypass?: boolean;
};

export async function addProjectInitJob(
  projectId: string,
  mode: 'import' | 'create',
  template?: string
) {
  return getProjectInitQueue().add('init', { projectId, mode, template });
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

export async function addReleaseJob(releaseId: string) {
  return getReleaseQueue().add(
    'release',
    { releaseId },
    {
      attempts: 1,
    }
  );
}

export async function addMigrationJob(
  runId: string,
  options?: { imageUrl?: string | null; allowApprovalBypass?: boolean }
) {
  return getMigrationQueue().add(
    'migrate',
    {
      runId,
      imageUrl: options?.imageUrl ?? null,
      allowApprovalBypass: options?.allowApprovalBypass ?? false,
    },
    {
      attempts: 1,
    }
  );
}

export async function closeQueues() {
  const promises: Promise<void>[] = [];
  if (_projectInitQueue) promises.push(_projectInitQueue.close());
  if (_releaseQueue) promises.push(_releaseQueue.close());
  if (_deploymentQueue) promises.push(_deploymentQueue.close());
  if (_migrationQueue) promises.push(_migrationQueue.close());
  return Promise.all(promises);
}
