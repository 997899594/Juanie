import { Job, Worker } from 'bullmq';
import { executeAITask } from '@/lib/ai/tasks/generic-task-service';
import { resolveRedisConnectionOptions } from '@/lib/redis/config';
import type { AITaskJobData } from './index';

export async function processAITask(job: Job<AITaskJobData>) {
  await executeAITask(job.data.taskId, job.data.kind);
  return { success: true };
}

export function createAITaskWorker() {
  return new Worker<AITaskJobData>('ai-task', processAITask, {
    connection: resolveRedisConnectionOptions({
      maxRetriesPerRequest: null,
    }),
    concurrency: 4,
  });
}
