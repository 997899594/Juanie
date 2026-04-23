import { applyControlPlaneMigrations } from '@/lib/db/control-plane-atlas';
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

async function main(): Promise<void> {
  const mode = process.argv[2];

  if (mode === 'control-plane-apply') {
    await applyControlPlaneMigrations();
    return;
  }

  if (mode === 'inspect') {
    await runSchemaInspectMode();
    return;
  }

  await runSchemaRepairMode();
}

main().catch((error) => {
  console.error(error instanceof Error ? (error.stack ?? error.message) : String(error));
  process.exit(1);
});
