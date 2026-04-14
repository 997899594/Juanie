-- Migration: 003_manual_migration_execution_modes
-- Description: Replace legacy autoRun with explicit executionMode and add external completion gates

DO $$
BEGIN
  CREATE TYPE "migrationExecutionMode" AS ENUM ('automatic', 'manual_platform', 'external');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TYPE "migrationRunStatus" ADD VALUE IF NOT EXISTS 'awaiting_external_completion';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TYPE "releaseStatus" ADD VALUE IF NOT EXISTS 'awaiting_external_completion';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "migrationSpecification"
  ADD COLUMN IF NOT EXISTS "executionMode" "migrationExecutionMode";

UPDATE "migrationSpecification"
SET "executionMode" = CASE
  WHEN "executionMode" IS NOT NULL THEN "executionMode"
  WHEN "autoRun" IS TRUE THEN 'automatic'::"migrationExecutionMode"
  ELSE 'manual_platform'::"migrationExecutionMode"
END;

ALTER TABLE "migrationSpecification"
  ALTER COLUMN "executionMode" SET NOT NULL;

ALTER TABLE "migrationSpecification"
  ALTER COLUMN "executionMode" DROP DEFAULT;

ALTER TABLE "migrationSpecification"
  DROP COLUMN IF EXISTS "autoRun";
