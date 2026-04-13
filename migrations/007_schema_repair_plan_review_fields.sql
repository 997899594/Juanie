-- Migration: 007_schema_repair_plan_review_fields
-- Description: Track review workflow metadata for schema repair plans

DO $$
BEGIN
  CREATE TYPE "schemaRepairPlanStatus" AS ENUM ('draft', 'review_opened', 'failed');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "schemaRepairPlan"
  ADD COLUMN IF NOT EXISTS "status" "schemaRepairPlanStatus" NOT NULL DEFAULT 'draft';

ALTER TABLE "schemaRepairPlan"
  ADD COLUMN IF NOT EXISTS "generatedFiles" jsonb;

ALTER TABLE "schemaRepairPlan"
  ADD COLUMN IF NOT EXISTS "branchName" varchar(255);

ALTER TABLE "schemaRepairPlan"
  ADD COLUMN IF NOT EXISTS "reviewNumber" integer;

ALTER TABLE "schemaRepairPlan"
  ADD COLUMN IF NOT EXISTS "reviewUrl" text;

ALTER TABLE "schemaRepairPlan"
  ADD COLUMN IF NOT EXISTS "errorMessage" text;
