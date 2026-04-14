-- Migration: 012_atlas_execution_queued
-- Description: Add queued status to Atlas execution workflow

DO $$
BEGIN
  ALTER TYPE "atlasExecutionStatus" ADD VALUE IF NOT EXISTS 'queued';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
