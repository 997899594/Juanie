import { and, isNull, lt, or, sql } from 'drizzle-orm';
import { db } from '@/lib/db';
import { aiPluginRuns, aiPluginSnapshots, auditLogs, deploymentLogs } from '@/lib/db/schema';

const DAY_MS = 24 * 60 * 60 * 1000;

function parseRetentionDays(value: string | undefined, fallbackDays: number): number {
  const parsed = Number.parseInt(value ?? '', 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallbackDays;
  }

  return parsed;
}

export interface HistoryRetentionPolicy {
  deploymentLogDays: number;
  auditLogDays: number;
  aiPluginRunDays: number;
  aiPluginSnapshotDays: number;
  migrationRunDays: number;
  schemaRepairAtlasRunDays: number;
}

export interface HistoryRetentionResult {
  deletedDeploymentLogs: number;
  deletedAuditLogs: number;
  deletedAIPluginRuns: number;
  deletedAIPluginSnapshots: number;
  deletedMigrationRuns: number;
  deletedSchemaRepairAtlasRuns: number;
}

export function getHistoryRetentionPolicy(): HistoryRetentionPolicy {
  return {
    deploymentLogDays: parseRetentionDays(process.env.DEPLOYMENT_LOG_RETENTION_DAYS, 14),
    auditLogDays: parseRetentionDays(process.env.AUDIT_LOG_RETENTION_DAYS, 30),
    aiPluginRunDays: parseRetentionDays(process.env.AI_PLUGIN_RUN_RETENTION_DAYS, 14),
    aiPluginSnapshotDays: parseRetentionDays(process.env.AI_PLUGIN_SNAPSHOT_RETENTION_DAYS, 30),
    migrationRunDays: parseRetentionDays(process.env.MIGRATION_RUN_RETENTION_DAYS, 30),
    schemaRepairAtlasRunDays: parseRetentionDays(
      process.env.SCHEMA_REPAIR_ATLAS_RUN_RETENTION_DAYS,
      30
    ),
  };
}

function daysAgo(days: number): Date {
  return new Date(Date.now() - days * DAY_MS);
}

export async function cleanupRetainedHistory(
  policy: HistoryRetentionPolicy = getHistoryRetentionPolicy()
): Promise<HistoryRetentionResult> {
  const deploymentLogCutoff = daysAgo(policy.deploymentLogDays);
  const auditLogCutoff = daysAgo(policy.auditLogDays);
  const aiPluginRunCutoff = daysAgo(policy.aiPluginRunDays);
  const aiPluginSnapshotCutoff = daysAgo(policy.aiPluginSnapshotDays);
  const migrationRunCutoff = daysAgo(policy.migrationRunDays);
  const schemaRepairAtlasRunCutoff = daysAgo(policy.schemaRepairAtlasRunDays);

  const [
    deletedDeploymentLogs,
    deletedAuditLogs,
    deletedAIPluginRuns,
    deletedAIPluginSnapshots,
    deletedMigrationRuns,
    deletedSchemaRepairAtlasRuns,
  ] = await Promise.all([
    db
      .delete(deploymentLogs)
      .where(lt(deploymentLogs.createdAt, deploymentLogCutoff))
      .returning({ id: deploymentLogs.id })
      .then((rows) => rows.length),
    db
      .delete(auditLogs)
      .where(lt(auditLogs.createdAt, auditLogCutoff))
      .returning({ id: auditLogs.id })
      .then((rows) => rows.length),
    db
      .delete(aiPluginRuns)
      .where(lt(aiPluginRuns.createdAt, aiPluginRunCutoff))
      .returning({ id: aiPluginRuns.id })
      .then((rows) => rows.length),
    db
      .delete(aiPluginSnapshots)
      .where(
        and(
          lt(aiPluginSnapshots.generatedAt, aiPluginSnapshotCutoff),
          or(
            isNull(aiPluginSnapshots.lastAccessedAt),
            lt(aiPluginSnapshots.lastAccessedAt, aiPluginSnapshotCutoff)
          )
        )
      )
      .returning({ id: aiPluginSnapshots.id })
      .then((rows) => rows.length),
    db
      .execute(sql<{ id: string }>`
          delete from "migrationRun" as run
          where run.status in ('success', 'failed', 'canceled', 'skipped')
            and run."createdAt" < ${migrationRunCutoff}
            and exists (
              select 1
              from "migrationRun" newer
              where newer."lockKey" = run."lockKey"
                and newer."createdAt" > run."createdAt"
            )
          returning run.id
        `)
      .then((rows) => rows.length),
    db
      .execute(sql<{ id: string }>`
          delete from "schemaRepairAtlasRun" as run
          where run.status in ('succeeded', 'failed')
            and run."createdAt" < ${schemaRepairAtlasRunCutoff}
            and exists (
              select 1
              from "schemaRepairAtlasRun" newer
              where newer."projectId" = run."projectId"
                and newer."databaseId" = run."databaseId"
                and newer."createdAt" > run."createdAt"
            )
          returning run.id
        `)
      .then((rows) => rows.length),
  ]);

  return {
    deletedDeploymentLogs,
    deletedAuditLogs,
    deletedAIPluginRuns,
    deletedAIPluginSnapshots,
    deletedMigrationRuns,
    deletedSchemaRepairAtlasRuns,
  };
}
