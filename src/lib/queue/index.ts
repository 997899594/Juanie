import { type ConnectionOptions, Queue } from 'bullmq';
import type { AITaskKind } from '@/lib/ai/tasks/catalog';
import { resolveRedisConnectionOptions } from '@/lib/redis/config';

function getConnection(): ConnectionOptions {
  return resolveRedisConnectionOptions({
    maxRetriesPerRequest: null,
  }) as ConnectionOptions;
}

let _aiTaskQueue: Queue | null = null;

export function getAITaskQueue(): Queue {
  if (!_aiTaskQueue) {
    _aiTaskQueue = new Queue('ai-task', { connection: getConnection() });
  }
  return _aiTaskQueue;
}

export type AITaskJobData = {
  taskId: string;
  kind: AITaskKind;
};

export function buildAITaskJobId(taskId: string): string {
  return `ai-task-${taskId}`;
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
      jobId: buildAITaskJobId(taskId),
      removeOnComplete: true,
      removeOnFail: true,
    }
  );
}

export async function closeQueues() {
  const promises: Promise<void>[] = [];
  if (_aiTaskQueue) promises.push(_aiTaskQueue.close());
  return Promise.all(promises);
}
