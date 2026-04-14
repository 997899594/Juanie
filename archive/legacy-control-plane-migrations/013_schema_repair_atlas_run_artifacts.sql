-- Migration: 013_schema_repair_atlas_run_artifacts
-- Description: Persist generated artifact contents and execution job identity for schema repair runs

ALTER TABLE "schemaRepairAtlasRun"
  ADD COLUMN IF NOT EXISTS "artifactFiles" jsonb;

ALTER TABLE "schemaRepairAtlasRun"
  ADD COLUMN IF NOT EXISTS "jobName" varchar(255);
