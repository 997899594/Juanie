import { Cron } from 'croner';
import { cleanupRetainedHistory, getHistoryRetentionPolicy } from '@/lib/history/retention';
import { logger } from '@/lib/logger';

let historyRetentionRunning = false;

const DEFAULT_HISTORY_RETENTION_SCHEDULE = process.env.HISTORY_RETENTION_SCHEDULE || '17 */6 * * *';
const historyRetentionLogger = logger.child({ component: 'history-retention' });

export function startHistoryRetention(): void {
  if (historyRetentionRunning) {
    historyRetentionLogger.info('History retention already running');
    return;
  }

  historyRetentionRunning = true;

  new Cron(DEFAULT_HISTORY_RETENTION_SCHEDULE, async () => {
    try {
      const policy = getHistoryRetentionPolicy();
      const result = await cleanupRetainedHistory(policy);
      historyRetentionLogger.info('History retention cleanup completed', {
        deletedDeploymentLogs: result.deletedDeploymentLogs,
        deletedAuditLogs: result.deletedAuditLogs,
        deletedAIPluginRuns: result.deletedAIPluginRuns,
        deletedAIPluginSnapshots: result.deletedAIPluginSnapshots,
        deletedMigrationRuns: result.deletedMigrationRuns,
        deletedSchemaRepairAtlasRuns: result.deletedSchemaRepairAtlasRuns,
        policy,
      });
    } catch (error) {
      historyRetentionLogger.error('History retention cleanup failed', error);
    }
  });

  const policy = getHistoryRetentionPolicy();
  historyRetentionLogger.info('History retention started', {
    schedule: DEFAULT_HISTORY_RETENTION_SCHEDULE,
    deploymentLogDays: policy.deploymentLogDays,
    auditLogDays: policy.auditLogDays,
    aiPluginRunDays: policy.aiPluginRunDays,
    aiPluginSnapshotDays: policy.aiPluginSnapshotDays,
    migrationRunDays: policy.migrationRunDays,
    schemaRepairAtlasRunDays: policy.schemaRepairAtlasRunDays,
  });
}
