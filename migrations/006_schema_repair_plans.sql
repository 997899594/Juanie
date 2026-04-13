-- Migration: 006_schema_repair_plans
-- Description: Persist generated schema repair plans per environment database

DO $$
BEGIN
  CREATE TYPE "schemaRepairPlanKind" AS ENUM (
    'no_action',
    'run_release_migrations',
    'mark_aligned',
    'repair_pr_required',
    'adopt_current_db',
    'manual_investigation'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "schemaRepairPlan" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "projectId" uuid NOT NULL REFERENCES "project"("id") ON DELETE CASCADE,
  "environmentId" uuid NOT NULL REFERENCES "environment"("id") ON DELETE CASCADE,
  "databaseId" uuid NOT NULL REFERENCES "database"("id") ON DELETE CASCADE,
  "stateStatus" "environmentSchemaStateStatus" NOT NULL,
  "kind" "schemaRepairPlanKind" NOT NULL,
  "title" varchar(255) NOT NULL,
  "summary" text NOT NULL,
  "riskLevel" varchar(20) NOT NULL,
  "expectedVersion" varchar(255),
  "actualVersion" varchar(255),
  "nextActionLabel" text,
  "steps" jsonb NOT NULL,
  "createdByUserId" uuid REFERENCES "user"("id") ON DELETE SET NULL,
  "createdAt" timestamp NOT NULL DEFAULT now(),
  "updatedAt" timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "schemaRepairPlan_projectId_idx"
  ON "schemaRepairPlan" ("projectId");

CREATE INDEX IF NOT EXISTS "schemaRepairPlan_environmentId_idx"
  ON "schemaRepairPlan" ("environmentId");

CREATE INDEX IF NOT EXISTS "schemaRepairPlan_databaseId_idx"
  ON "schemaRepairPlan" ("databaseId");

CREATE INDEX IF NOT EXISTS "schemaRepairPlan_createdAt_idx"
  ON "schemaRepairPlan" ("createdAt");
