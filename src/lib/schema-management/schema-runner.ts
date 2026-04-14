import { applyControlPlaneMigrations } from '@/lib/db/control-plane-atlas';
import { executeSchemaRepairAtlasRun } from '@/lib/schema-management/atlas-run';

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

async function main(): Promise<void> {
  const mode = process.argv[2];

  if (mode === 'control-plane-apply') {
    await applyControlPlaneMigrations();
    return;
  }

  await runSchemaRepairMode();
}

main().catch((error) => {
  console.error(error instanceof Error ? (error.stack ?? error.message) : String(error));
  process.exit(1);
});
