import { logger } from '@/lib/logger';
import { createAITaskWorker } from './ai-task';

const workerLogger = logger.child({ component: 'queue-worker' });

workerLogger.info('Starting Juanie workers');

const aiTaskWorker = createAITaskWorker();

aiTaskWorker.on('completed', (job) => {
  workerLogger.info('AI task job completed', {
    jobId: job.id,
    queue: 'ai-task',
  });
});

aiTaskWorker.on('failed', (job, err) => {
  workerLogger.error('AI task job failed', err, {
    jobId: job?.id,
    queue: 'ai-task',
  });
});

process.on('SIGTERM', async () => {
  workerLogger.info('Shutting down workers', { signal: 'SIGTERM' });
  await Promise.all([aiTaskWorker.close()]);
  process.exit(0);
});

process.on('SIGINT', async () => {
  workerLogger.info('Shutting down workers', { signal: 'SIGINT' });
  await Promise.all([aiTaskWorker.close()]);
  process.exit(0);
});

workerLogger.info('Workers started successfully', {
  queues: ['ai-task'],
});
