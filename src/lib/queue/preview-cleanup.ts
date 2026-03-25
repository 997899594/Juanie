import { Cron } from 'croner';
import { cleanupExpiredPreviewEnvironments } from '@/lib/environments/cleanup';

let previewCleanupRunning = false;

export function startPreviewEnvironmentCleanup(): void {
  if (previewCleanupRunning) {
    console.log('[PreviewCleanup] Already running');
    return;
  }

  previewCleanupRunning = true;

  new Cron('*/15 * * * *', async () => {
    console.log('[PreviewCleanup] Checking expired preview environments...');
    try {
      const result = await cleanupExpiredPreviewEnvironments();
      if (result.deletedIds.length > 0 || result.skipped.length > 0) {
        console.log(
          `[PreviewCleanup] deleted=${result.deletedIds.length}, skipped=${result.skipped.length}`
        );
      }
    } catch (error) {
      console.error('[PreviewCleanup] Error:', error);
    }
  });

  console.log('[PreviewCleanup] Started (runs every 15 minutes)');
}
