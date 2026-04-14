-- Migration: 000_migration_tracker
-- Description: Create migration tracking table
-- Created: 2026-02-28

-- This should be run first to create the migration tracking table
CREATE TABLE IF NOT EXISTS "_migrations" (
  "id" serial PRIMARY KEY,
  "name" varchar(255) NOT NULL UNIQUE,
  "executed_at" timestamp NOT NULL DEFAULT NOW()
);
