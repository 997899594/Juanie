-- Migration: 005_environment_schema_pending_migrations
-- Description: Distinguish managed-but-behind schema state from true drift

DO $$
BEGIN
  ALTER TYPE "environmentSchemaStateStatus" ADD VALUE IF NOT EXISTS 'pending_migrations';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
