-- Migration: 004_environment_schema_state
-- Description: Persist latest schema inspection state per environment database

DO $$
BEGIN
  CREATE TYPE "environmentSchemaStateStatus" AS ENUM (
    'aligned',
    'aligned_untracked',
    'drifted',
    'unmanaged',
    'blocked'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "environmentSchemaState" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "projectId" uuid NOT NULL REFERENCES "project"("id") ON DELETE CASCADE,
  "environmentId" uuid NOT NULL REFERENCES "environment"("id") ON DELETE CASCADE,
  "databaseId" uuid NOT NULL REFERENCES "database"("id") ON DELETE CASCADE,
  "status" "environmentSchemaStateStatus" NOT NULL DEFAULT 'unmanaged',
  "expectedVersion" varchar(255),
  "actualVersion" varchar(255),
  "expectedChecksum" varchar(64),
  "actualChecksum" varchar(64),
  "hasLedger" boolean NOT NULL DEFAULT false,
  "hasUserTables" boolean NOT NULL DEFAULT false,
  "summary" text,
  "lastInspectedAt" timestamp,
  "lastErrorCode" varchar(100),
  "lastErrorMessage" text,
  "createdAt" timestamp NOT NULL DEFAULT now(),
  "updatedAt" timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "environmentSchemaState_projectId_idx"
  ON "environmentSchemaState" ("projectId");

CREATE INDEX IF NOT EXISTS "environmentSchemaState_environmentId_idx"
  ON "environmentSchemaState" ("environmentId");

CREATE INDEX IF NOT EXISTS "environmentSchemaState_databaseId_idx"
  ON "environmentSchemaState" ("databaseId");

CREATE UNIQUE INDEX IF NOT EXISTS "environmentSchemaState_database_unique"
  ON "environmentSchemaState" ("databaseId");
