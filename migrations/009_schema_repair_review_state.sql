-- Migration: 009_schema_repair_review_state
-- Description: Persist remote review status for schema repair plans

DO $$
BEGIN
  CREATE TYPE "schemaRepairReviewState" AS ENUM ('draft', 'open', 'merged', 'closed', 'unknown');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "schemaRepairPlan"
  ADD COLUMN IF NOT EXISTS "reviewState" "schemaRepairReviewState" DEFAULT 'unknown';

ALTER TABLE "schemaRepairPlan"
  ADD COLUMN IF NOT EXISTS "reviewStateLabel" varchar(50);

ALTER TABLE "schemaRepairPlan"
  ADD COLUMN IF NOT EXISTS "reviewSyncedAt" timestamp;
