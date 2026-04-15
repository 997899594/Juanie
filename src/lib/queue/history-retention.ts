import { Cron } from 'croner';
import { cleanupRetainedHistory, getHistoryRetentionPolicy } from '@/lib/history/retention';

let historyRetentionRunning = false;

const DEFAULT_HISTORY_RETENTION_SCHEDULE = process.env.HISTORY_RETENTION_SCHEDULE || '17 */6 * * *';

export function startHistoryRetention(): void {
  if (historyRetentionRunning) {
    console.log('[HistoryRetention] Already running');
    return;
  }

  historyRetentionRunning = true;

  new Cron(DEFAULT_HISTORY_RETENTION_SCHEDULE, async () => {
    try {
      const policy = getHistoryRetentionPolicy();
      const result = await cleanupRetainedHistory(policy);
      console.log(
        `[HistoryRetention] cleaned deploymentLogs=${result.deletedDeploymentLogs}, auditLogs=${result.deletedAuditLogs}, aiPluginRuns=${result.deletedAIPluginRuns}, aiPluginSnapshots=${result.deletedAIPluginSnapshots}, migrationRuns=${result.deletedMigrationRuns}, schemaRepairAtlasRuns=${result.deletedSchemaRepairAtlasRuns}`
      );
    } catch (error) {
      console.error('[HistoryRetention] Error:', error);
    }
  });

  console.log(
    `[HistoryRetention] Started (schedule: ${DEFAULT_HISTORY_RETENTION_SCHEDULE}, deploymentLogs=${getHistoryRetentionPolicy().deploymentLogDays}d, auditLogs=${getHistoryRetentionPolicy().auditLogDays}d, aiRuns=${getHistoryRetentionPolicy().aiPluginRunDays}d, aiSnapshots=${getHistoryRetentionPolicy().aiPluginSnapshotDays}d, migrationRuns=${getHistoryRetentionPolicy().migrationRunDays}d, schemaRepairAtlasRuns=${getHistoryRetentionPolicy().schemaRepairAtlasRunDays}d)`
  );
}
