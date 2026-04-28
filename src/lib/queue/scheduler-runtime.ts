import { initK8sClient } from '@/lib/k8s';
import { logger } from '@/lib/logger';
import { startEnvironmentIdleSleep } from './environment-idle-sleep';
import { startEnvironmentRouteReconciliation } from './environment-route-reconciliation';
import { startHistoryRetention } from './history-retention';
import { startInfrastructureRemediation } from './infrastructure-remediation';
import { startMigrationStateHealing } from './migration-state-healing';
import { startPreviewEnvironmentCleanup } from './preview-cleanup';
import { startSchemaRepairReviewSync } from './schema-repair-review-sync';
import { startSchemaStateHealing } from './schema-state-healing';

const schedulerLogger = logger.child({ component: 'scheduler' });

let started = false;

export function startSchedulerRuntime(): string[] {
  if (started) {
    schedulerLogger.info('Scheduler runtime already started');
    return [];
  }

  started = true;
  initK8sClient();

  schedulerLogger.info('Starting Juanie scheduler runtime');

  const enabledTasks: string[] = [];

  if (process.env.ENABLE_PREVIEW_CLEANUP !== 'false') {
    startPreviewEnvironmentCleanup();
    enabledTasks.push('preview-cleanup');
  }

  if (process.env.ENABLE_IDLE_SLEEP !== 'false') {
    startEnvironmentIdleSleep();
    enabledTasks.push('environment-idle-sleep');
  }

  if (process.env.ENABLE_ROUTE_RECONCILIATION !== 'false') {
    startEnvironmentRouteReconciliation();
    enabledTasks.push('environment-route-reconciliation');
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

  if (process.env.ENABLE_SCHEMA_STATE_HEALING !== 'false') {
    startSchemaStateHealing();
    enabledTasks.push('schema-state-healing');
  }

  if (process.env.ENABLE_MIGRATION_STATE_HEALING !== 'false') {
    startMigrationStateHealing();
    enabledTasks.push('migration-state-healing');
  }

  schedulerLogger.info('Scheduler runtime started successfully', {
    enabledTasks,
  });

  return enabledTasks;
}
