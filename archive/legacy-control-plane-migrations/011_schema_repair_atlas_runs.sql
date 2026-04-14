-- Migration: 011_schema_repair_atlas_runs
-- Description: Persist structured Atlas execution runs for schema repair workflow

CREATE TABLE IF NOT EXISTS "schemaRepairAtlasRun" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "planId" uuid NOT NULL REFERENCES "schemaRepairPlan"("id") ON DELETE CASCADE,
  "projectId" uuid NOT NULL REFERENCES "project"("id") ON DELETE CASCADE,
  "environmentId" uuid NOT NULL REFERENCES "environment"("id") ON DELETE CASCADE,
  "databaseId" uuid NOT NULL REFERENCES "database"("id") ON DELETE CASCADE,
  "status" "atlasExecutionStatus" NOT NULL DEFAULT 'idle',
  "exitCode" integer,
  "generatedFiles" jsonb,
  "diffSummary" jsonb,
  "commitSha" varchar(100),
  "log" text,
  "errorMessage" text,
  "startedAt" timestamp,
  "finishedAt" timestamp,
  "createdAt" timestamp NOT NULL DEFAULT now(),
  "updatedAt" timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "schemaRepairAtlasRun_planId_idx"
  ON "schemaRepairAtlasRun" ("planId");

CREATE INDEX IF NOT EXISTS "schemaRepairAtlasRun_projectId_idx"
  ON "schemaRepairAtlasRun" ("projectId");

CREATE INDEX IF NOT EXISTS "schemaRepairAtlasRun_databaseId_idx"
  ON "schemaRepairAtlasRun" ("databaseId");

CREATE INDEX IF NOT EXISTS "schemaRepairAtlasRun_createdAt_idx"
  ON "schemaRepairAtlasRun" ("createdAt");
