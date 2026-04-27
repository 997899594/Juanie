import { closeDb } from '@/lib/db';
import { applyControlPlaneMigrations } from '@/lib/db/control-plane-atlas';
import { executeMigrationRunInExecutionService } from '@/lib/migrations/execution-service';
import { closeQueues } from '@/lib/queue';
import { shutdownSchemaRepairRealtimePublisher } from '@/lib/realtime/schema-repairs';
import { executeSchemaRepairAtlasRun } from '@/lib/schema-management/atlas-run';
import { inspectEnvironmentSchemaStateLocally } from '@/lib/schema-management/inspect';

async function runSchemaRepairMode(): Promise<void> {
  const atlasRunId = process.env.SCHEMA_REPAIR_ATLAS_RUN_ID;
  const projectId = process.env.SCHEMA_REPAIR_PROJECT_ID;
  const userId = process.env.SCHEMA_REPAIR_USER_ID ?? null;

  if (!atlasRunId || !projectId) {
    throw new Error('SCHEMA_REPAIR_ATLAS_RUN_ID and SCHEMA_REPAIR_PROJECT_ID are required');
  }

  await executeSchemaRepairAtlasRun({
    atlasRunId,
    projectId,
    userId,
  });
}

async function runSchemaInspectMode(): Promise<void> {
  const projectId = process.env.SCHEMA_INSPECT_PROJECT_ID;
  const databaseId = process.env.SCHEMA_INSPECT_DATABASE_ID;
  const sourceRef = process.env.SCHEMA_INSPECT_SOURCE_REF ?? null;
  const sourceCommitSha = process.env.SCHEMA_INSPECT_SOURCE_COMMIT_SHA ?? null;

  if (!projectId || !databaseId) {
    throw new Error('SCHEMA_INSPECT_PROJECT_ID and SCHEMA_INSPECT_DATABASE_ID are required');
  }

  await inspectEnvironmentSchemaStateLocally({
    projectId,
    databaseId,
    sourceRef,
    sourceCommitSha,
  });
}

function parseBooleanEnv(value: string | undefined): boolean {
  if (!value) {
    return false;
  }

  return ['1', 'true', 'yes', 'on'].includes(value.trim().toLowerCase());
}

async function runMigrationMode(): Promise<void> {
  const runId = process.env.MIGRATION_RUN_ID;

  if (!runId) {
    throw new Error('MIGRATION_RUN_ID is required');
  }

  await executeMigrationRunInExecutionService({
    runId,
    allowApprovalBypass: parseBooleanEnv(process.env.MIGRATION_ALLOW_APPROVAL_BYPASS),
  });
}

export async function runSchemaRunnerCli(args = process.argv): Promise<void> {
  const mode = args[2];

  try {
    if (mode === 'control-plane-apply') {
      await applyControlPlaneMigrations();
      return;
    }

    if (mode === 'inspect') {
      await runSchemaInspectMode();
      return;
    }

    if (mode === 'migration') {
      await runMigrationMode();
      return;
    }

    await runSchemaRepairMode();
  } finally {
    await closeQueues();
    await closeDb();
    await shutdownSchemaRepairRealtimePublisher();
  }
}

if (import.meta.main) {
  runSchemaRunnerCli().catch((error) => {
    console.error(error instanceof Error ? (error.stack ?? error.message) : String(error));
    process.exit(1);
  });
}
