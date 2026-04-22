import { Job, Worker } from 'bullmq';
import {
  executeEnvironmentDeepAnalysisTask,
  executeReleaseDeepAnalysisTask,
} from '@/lib/ai/tasks/generic-task-service';
import { resolveRedisConnectionOptions } from '@/lib/redis/config';
import type { AITaskJobData } from './index';

export async function processAITask(job: Job<AITaskJobData>) {
  if (job.data.kind === 'environment_deep_analysis') {
    await executeEnvironmentDeepAnalysisTask(job.data.taskId);
    return { success: true };
  }

  if (job.data.kind === 'release_deep_analysis') {
    await executeReleaseDeepAnalysisTask(job.data.taskId);
    return { success: true };
  }

  throw new Error(`Unsupported AI task kind: ${job.data.kind}`);
}

export function createAITaskWorker() {
  return new Worker<AITaskJobData>('ai-task', processAITask, {
    connection: resolveRedisConnectionOptions({
      maxRetriesPerRequest: null,
    }),
    concurrency: 4,
  });
}
