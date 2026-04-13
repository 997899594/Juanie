import { initK8sClient } from '@/lib/k8s';
import { startDriftDetector } from './drift-detector';
import { startHistoryRetention } from './history-retention';
import { startInfrastructureRemediation } from './infrastructure-remediation';
import { startPreviewEnvironmentCleanup } from './preview-cleanup';
import { startSchemaRepairReviewSync } from './schema-repair-review-sync';

initK8sClient();

console.log('Starting Juanie scheduler...');

const enabledTasks: string[] = [];

if (process.env.ENABLE_DRIFT_DETECTOR !== 'false') {
  startDriftDetector();
  enabledTasks.push('drift-detector');
}

if (process.env.ENABLE_PREVIEW_CLEANUP !== 'false') {
  startPreviewEnvironmentCleanup();
  enabledTasks.push('preview-cleanup');
}

if (process.env.ENABLE_AUTO_REMEDIATION !== 'false') {
  startInfrastructureRemediation();
  enabledTasks.push('infra-remediation');
}

if (process.env.ENABLE_HISTORY_RETENTION !== 'false') {
  startHistoryRetention();
  enabledTasks.push('history-retention');
}

if (process.env.ENABLE_SCHEMA_REPAIR_REVIEW_SYNC !== 'false') {
  startSchemaRepairReviewSync();
  enabledTasks.push('schema-repair-review-sync');
}

console.log(
  `Scheduler started successfully (${enabledTasks.length > 0 ? enabledTasks.join(', ') : 'no tasks enabled'})`
);

function shutdown(signal: string): void {
  console.log(`Shutting down scheduler (${signal})...`);
  process.exit(0);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
