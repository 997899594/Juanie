import type { MigrationSpecificationSnapshot, migrationSpecifications } from '@/lib/db/schema';

type MigrationSpecificationRecord = typeof migrationSpecifications.$inferSelect;

export function createMigrationSpecificationSnapshot(
  specification: MigrationSpecificationRecord
): MigrationSpecificationSnapshot {
  return {
    source: specification.source,
    tool: specification.tool,
    phase: specification.phase,
    executionMode: specification.executionMode,
    releaseStage: specification.releaseStage,
    stageOrder: specification.stageOrder,
    targetVersion: specification.targetVersion,
    baselineVersion: specification.baselineVersion,
    sourceConfigPath: specification.sourceConfigPath,
    migrationPath: specification.migrationPath,
    command: specification.command,
    lockStrategy: specification.lockStrategy,
    compatibility: specification.compatibility,
    approvalPolicy: specification.approvalPolicy,
  };
}

export function restoreMigrationSpecificationSnapshot(
  specification: MigrationSpecificationRecord,
  snapshot: MigrationSpecificationSnapshot
): MigrationSpecificationRecord {
  return {
    ...specification,
    ...snapshot,
  };
}
