import { logger } from '@/lib/logger';
import { acquireSchedulerLeadership } from './scheduler-leader-election';
import { startSchedulerRuntime } from './scheduler-runtime';

const schedulerLogger = logger.child({ component: 'scheduler' });

const stopLeaderElection = await acquireSchedulerLeadership();
startSchedulerRuntime();

function shutdown(signal: string): void {
  schedulerLogger.info('Shutting down scheduler', { signal });
  stopLeaderElection();
  process.exit(0);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
