-- Migration: 008_schema_repair_plan_statuses
-- Description: Add applied and superseded states to schema repair plan workflow

DO $$
BEGIN
  ALTER TYPE "schemaRepairPlanStatus" ADD VALUE IF NOT EXISTS 'applied';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TYPE "schemaRepairPlanStatus" ADD VALUE IF NOT EXISTS 'superseded';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
