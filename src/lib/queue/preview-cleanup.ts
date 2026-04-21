import { Cron } from 'croner';
import { cleanupExpiredPreviewEnvironments } from '@/lib/environments/cleanup';
import { logger } from '@/lib/logger';

let previewCleanupRunning = false;
const previewCleanupLogger = logger.child({ component: 'preview-cleanup' });

export function startPreviewEnvironmentCleanup(): void {
  if (previewCleanupRunning) {
    previewCleanupLogger.info('Preview cleanup already running');
    return;
  }

  previewCleanupRunning = true;

  new Cron('*/15 * * * *', async () => {
    previewCleanupLogger.info('Checking expired preview environments');
    try {
      const result = await cleanupExpiredPreviewEnvironments();
      if (result.deletedIds.length > 0 || result.skipped.length > 0) {
        previewCleanupLogger.info('Preview cleanup completed', {
          deletedCount: result.deletedIds.length,
          skippedCount: result.skipped.length,
          deletedIds: result.deletedIds,
          skipped: result.skipped,
        });
      }
    } catch (error) {
      previewCleanupLogger.error('Preview cleanup failed', error);
    }
  });

  previewCleanupLogger.info('Preview cleanup started', {
    schedule: '*/15 * * * *',
  });
}
