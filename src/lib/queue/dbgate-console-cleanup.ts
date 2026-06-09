import { Cron } from 'croner';
import { cleanupIdleDbGateDatabaseConsoles } from '@/lib/database-console/dbgate-session';
import { logger } from '@/lib/logger';

const DEFAULT_DBGATE_CONSOLE_CLEANUP_SCHEDULE =
  process.env.DBGATE_CONSOLE_CLEANUP_SCHEDULE?.trim() || '*/15 * * * *';

const dbgateCleanupLogger = logger.child({ component: 'dbgate-console-cleanup' });

let dbgateConsoleCleanupRunning = false;

export function startDbGateConsoleCleanup(): void {
  if (dbgateConsoleCleanupRunning) {
    dbgateCleanupLogger.info('DbGate console cleanup already running');
    return;
  }

  dbgateConsoleCleanupRunning = true;

  new Cron(DEFAULT_DBGATE_CONSOLE_CLEANUP_SCHEDULE, async () => {
    try {
      const result = await cleanupIdleDbGateDatabaseConsoles();
      if (result.deleted > 0 || result.skipped > 0) {
        dbgateCleanupLogger.info('DbGate console cleanup completed', result);
      }
    } catch (error) {
      dbgateCleanupLogger.error('DbGate console cleanup failed', error);
    }
  });

  dbgateCleanupLogger.info('DbGate console cleanup started', {
    schedule: DEFAULT_DBGATE_CONSOLE_CLEANUP_SCHEDULE,
  });
}
