import { logger } from '@/lib/logger';
import { startSchedulerRuntime } from './scheduler-runtime';

const schedulerLogger = logger.child({ component: 'scheduler' });

startSchedulerRuntime();

function shutdown(signal: string): void {
  schedulerLogger.info('Shutting down scheduler', { signal });
  process.exit(0);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
