import { type ConnectionOptions, Queue } from 'bullmq';
import type { AITaskKind } from '@/lib/ai/tasks/catalog';
import { resolveRedisConnectionOptions } from '@/lib/redis/config';

function getConnection(): ConnectionOptions {
  return resolveRedisConnectionOptions({
    maxRetriesPerRequest: null,
  }) as ConnectionOptions;
}

let _projectInitQueue: Queue | null = null;
let _projectDeleteQueue: Queue | null = null;
let _releaseQueue: Queue | null = null;
let _deploymentQueue: Queue | null = null;
let _migrationQueue: Queue | null = null;
let _schemaRepairAtlasQueue: Queue | null = null;
let _aiTaskQueue: Queue | null = null;

export function getProjectInitQueue(): Queue {
  if (!_projectInitQueue) {
    _projectInitQueue = new Queue('project-init', { connection: getConnection() });
  }
  return _projectInitQueue;
}

export function getProjectDeleteQueue(): Queue {
  if (!_projectDeleteQueue) {
    _projectDeleteQueue = new Queue('project-delete', { connection: getConnection() });
  }
  return _projectDeleteQueue;
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

export function getSchemaRepairAtlasQueue(): Queue {
  if (!_schemaRepairAtlasQueue) {
    _schemaRepairAtlasQueue = new Queue('schema-repair-atlas', { connection: getConnection() });
  }
  return _schemaRepairAtlasQueue;
}

export function getAITaskQueue(): Queue {
  if (!_aiTaskQueue) {
    _aiTaskQueue = new Queue('ai-task', { connection: getConnection() });
  }
  return _aiTaskQueue;
}

export type ProjectInitJobData = {
  projectId: string;
  mode: 'import' | 'create';
  template?: string;
};

export type ProjectDeleteJobData = {
  projectId: string;
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
  allowApprovalBypass?: boolean;
};

export type SchemaRepairAtlasJobData = {
  atlasRunId: string;
  projectId: string;
  userId: string | null;
};

export type AITaskJobData = {
  taskId: string;
  kind: AITaskKind;
};

export async function addProjectInitJob(
  projectId: string,
  mode: 'import' | 'create',
  template?: string
) {
  return getProjectInitQueue().add(
    'init',
    { projectId, mode, template },
    {
      attempts: 2,
      backoff: {
        type: 'exponential',
        delay: 5000,
      },
    }
  );
}

export async function addProjectDeleteJob(projectId: string) {
  return getProjectDeleteQueue().add(
    'delete',
    { projectId },
    {
      attempts: 5,
      backoff: {
        type: 'exponential',
        delay: 15000,
      },
      jobId: `project-delete-${projectId}`,
      removeOnComplete: true,
      removeOnFail: true,
    }
  );
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
      attempts: 1,
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

export async function addMigrationJob(runId: string, options?: { allowApprovalBypass?: boolean }) {
  return getMigrationQueue().add(
    'migrate',
    {
      runId,
      allowApprovalBypass: options?.allowApprovalBypass ?? false,
    },
    {
      attempts: 1,
    }
  );
}

export async function addSchemaRepairAtlasJob(
  atlasRunId: string,
  projectId: string,
  userId?: string | null
) {
  return getSchemaRepairAtlasQueue().add(
    'schema-repair-atlas',
    {
      atlasRunId,
      projectId,
      userId: userId ?? null,
    },
    {
      attempts: 1,
      jobId: `schema-repair-atlas-${atlasRunId}`,
    }
  );
}

export async function addAITaskJob(taskId: string, kind: AITaskKind) {
  return getAITaskQueue().add(
    'ai-task',
    {
      taskId,
      kind,
    },
    {
      attempts: 1,
      jobId: `ai-task-${taskId}`,
    }
  );
}

export async function closeQueues() {
  const promises: Promise<void>[] = [];
  if (_projectInitQueue) promises.push(_projectInitQueue.close());
  if (_projectDeleteQueue) promises.push(_projectDeleteQueue.close());
  if (_releaseQueue) promises.push(_releaseQueue.close());
  if (_deploymentQueue) promises.push(_deploymentQueue.close());
  if (_migrationQueue) promises.push(_migrationQueue.close());
  if (_schemaRepairAtlasQueue) promises.push(_schemaRepairAtlasQueue.close());
  if (_aiTaskQueue) promises.push(_aiTaskQueue.close());
  return Promise.all(promises);
}
