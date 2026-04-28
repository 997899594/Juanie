import { Cron } from 'croner';
import { sleepIdleEnvironments } from '@/lib/environments/idle-sleep';
import { logger } from '@/lib/logger';

const DEFAULT_IDLE_SLEEP_SCHEDULE = process.env.IDLE_SLEEP_SCHEDULE || '*/15 * * * *';

let environmentIdleSleepRunning = false;
const idleSleepLogger = logger.child({ component: 'environment-idle-sleep' });

export function startEnvironmentIdleSleep(): void {
  if (environmentIdleSleepRunning) {
    idleSleepLogger.info('Environment idle sleep already running');
    return;
  }

  environmentIdleSleepRunning = true;

  new Cron(DEFAULT_IDLE_SLEEP_SCHEDULE, async () => {
    try {
      const result = await sleepIdleEnvironments();

      if (result.sleptIds.length > 0) {
        idleSleepLogger.info('Idle environments slept', {
          sleptIds: result.sleptIds,
          skippedCount: result.skipped.length,
        });
      }
    } catch (error) {
      idleSleepLogger.error('Environment idle sleep failed', error);
    }
  });

  idleSleepLogger.info('Environment idle sleep started', {
    schedule: DEFAULT_IDLE_SLEEP_SCHEDULE,
  });
}
