-- Migration: 010_schema_repair_atlas_execution
-- Description: Track Atlas execution status for schema repair plans

DO $$
BEGIN
  CREATE TYPE "atlasExecutionStatus" AS ENUM ('idle', 'running', 'succeeded', 'failed');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "schemaRepairPlan"
  ADD COLUMN IF NOT EXISTS "atlasExecutionStatus" "atlasExecutionStatus" DEFAULT 'idle';

ALTER TABLE "schemaRepairPlan"
  ADD COLUMN IF NOT EXISTS "atlasExecutionLog" text;

ALTER TABLE "schemaRepairPlan"
  ADD COLUMN IF NOT EXISTS "atlasExecutionStartedAt" timestamp;

ALTER TABLE "schemaRepairPlan"
  ADD COLUMN IF NOT EXISTS "atlasExecutionFinishedAt" timestamp;
