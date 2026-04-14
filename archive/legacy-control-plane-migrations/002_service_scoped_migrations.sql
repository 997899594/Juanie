-- Migration: 002_service_scoped_migrations
-- Description: Add service-scoped database bindings and migration control plane tables

DO $$
BEGIN
  CREATE TYPE "databaseScope" AS ENUM ('project', 'service');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE "databaseRole" AS ENUM ('primary', 'readonly', 'cache', 'queue', 'analytics');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TYPE "deploymentStatus" ADD VALUE IF NOT EXISTS 'migration_pending';
  ALTER TYPE "deploymentStatus" ADD VALUE IF NOT EXISTS 'migration_running';
  ALTER TYPE "deploymentStatus" ADD VALUE IF NOT EXISTS 'migration_failed';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE "migrationTool" AS ENUM ('drizzle', 'prisma', 'knex', 'typeorm', 'sql', 'custom');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE "migrationPhase" AS ENUM ('preDeploy', 'postDeploy', 'manual');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE "migrationRunStatus" AS ENUM (
    'queued',
    'awaiting_approval',
    'planning',
    'running',
    'success',
    'failed',
    'canceled',
    'skipped'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE "migrationRunnerType" AS ENUM ('k8s_job', 'ci_job', 'worker');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE "migrationLockStrategy" AS ENUM ('platform', 'db_advisory');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE "migrationCompatibility" AS ENUM ('backward_compatible', 'breaking');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE "migrationApprovalPolicy" AS ENUM ('auto', 'manual_in_production');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "database"
  ADD COLUMN IF NOT EXISTS "serviceId" uuid REFERENCES "service"("id") ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS "scope" "databaseScope" NOT NULL DEFAULT 'project',
  ADD COLUMN IF NOT EXISTS "role" "databaseRole" NOT NULL DEFAULT 'primary';

CREATE INDEX IF NOT EXISTS "database_serviceId_idx" ON "database" ("serviceId");

CREATE TABLE IF NOT EXISTS "migrationSpecification" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "projectId" uuid NOT NULL REFERENCES "project"("id") ON DELETE CASCADE,
  "serviceId" uuid NOT NULL REFERENCES "service"("id") ON DELETE CASCADE,
  "environmentId" uuid NOT NULL REFERENCES "environment"("id") ON DELETE CASCADE,
  "databaseId" uuid NOT NULL REFERENCES "database"("id") ON DELETE CASCADE,
  "tool" "migrationTool" NOT NULL,
  "phase" "migrationPhase" NOT NULL DEFAULT 'preDeploy',
  "autoRun" boolean NOT NULL DEFAULT true,
  "workingDirectory" varchar(500) NOT NULL,
  "migrationPath" varchar(500),
  "command" text NOT NULL,
  "lockStrategy" "migrationLockStrategy" NOT NULL DEFAULT 'platform',
  "compatibility" "migrationCompatibility" NOT NULL DEFAULT 'backward_compatible',
  "approvalPolicy" "migrationApprovalPolicy" NOT NULL DEFAULT 'auto',
  "createdAt" timestamp NOT NULL DEFAULT NOW(),
  "updatedAt" timestamp NOT NULL DEFAULT NOW(),
  CONSTRAINT "migrationSpecification_service_env_db_unique"
    UNIQUE ("serviceId", "environmentId", "databaseId")
);

CREATE INDEX IF NOT EXISTS "migrationSpecification_projectId_idx"
  ON "migrationSpecification" ("projectId");
CREATE INDEX IF NOT EXISTS "migrationSpecification_serviceId_idx"
  ON "migrationSpecification" ("serviceId");
CREATE INDEX IF NOT EXISTS "migrationSpecification_environmentId_idx"
  ON "migrationSpecification" ("environmentId");
CREATE INDEX IF NOT EXISTS "migrationSpecification_databaseId_idx"
  ON "migrationSpecification" ("databaseId");

CREATE TABLE IF NOT EXISTS "migrationRun" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "projectId" uuid NOT NULL REFERENCES "project"("id") ON DELETE CASCADE,
  "serviceId" uuid NOT NULL REFERENCES "service"("id") ON DELETE CASCADE,
  "environmentId" uuid NOT NULL REFERENCES "environment"("id") ON DELETE CASCADE,
  "databaseId" uuid NOT NULL REFERENCES "database"("id") ON DELETE CASCADE,
  "specificationId" uuid NOT NULL REFERENCES "migrationSpecification"("id") ON DELETE CASCADE,
  "deploymentId" uuid REFERENCES "deployment"("id") ON DELETE SET NULL,
  "triggeredBy" varchar(20) NOT NULL,
  "triggeredByUserId" uuid REFERENCES "user"("id") ON DELETE SET NULL,
  "sourceCommitSha" varchar(100),
  "sourceCommitMessage" text,
  "status" "migrationRunStatus" NOT NULL DEFAULT 'queued',
  "runnerType" "migrationRunnerType" NOT NULL DEFAULT 'worker',
  "lockKey" varchar(255) NOT NULL,
  "startedAt" timestamp,
  "finishedAt" timestamp,
  "durationMs" integer,
  "appliedCount" integer,
  "logExcerpt" text,
  "logsUrl" text,
  "errorCode" varchar(100),
  "errorMessage" text,
  "createdAt" timestamp NOT NULL DEFAULT NOW(),
  "updatedAt" timestamp NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "migrationRun_projectId_idx" ON "migrationRun" ("projectId");
CREATE INDEX IF NOT EXISTS "migrationRun_serviceId_idx" ON "migrationRun" ("serviceId");
CREATE INDEX IF NOT EXISTS "migrationRun_environmentId_idx" ON "migrationRun" ("environmentId");
CREATE INDEX IF NOT EXISTS "migrationRun_databaseId_idx" ON "migrationRun" ("databaseId");
CREATE INDEX IF NOT EXISTS "migrationRun_deploymentId_idx" ON "migrationRun" ("deploymentId");
CREATE INDEX IF NOT EXISTS "migrationRun_status_idx" ON "migrationRun" ("status");

CREATE TABLE IF NOT EXISTS "migrationRunItem" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "migrationRunId" uuid NOT NULL REFERENCES "migrationRun"("id") ON DELETE CASCADE,
  "name" varchar(255) NOT NULL,
  "checksum" varchar(64),
  "status" "migrationRunStatus" NOT NULL DEFAULT 'queued',
  "startedAt" timestamp,
  "finishedAt" timestamp,
  "output" text,
  "error" text,
  "createdAt" timestamp NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "migrationRunItem_run_id_idx"
  ON "migrationRunItem" ("migrationRunId");

CREATE TABLE IF NOT EXISTS "databaseMigration" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "databaseId" uuid NOT NULL REFERENCES "database"("id") ON DELETE CASCADE,
  "filename" varchar(255) NOT NULL,
  "checksum" varchar(64) NOT NULL,
  "status" varchar(20) NOT NULL DEFAULT 'pending',
  "output" text,
  "error" text,
  "executedAt" timestamp,
  "createdAt" timestamp NOT NULL DEFAULT NOW(),
  CONSTRAINT "databaseMigration_databaseId_filename_unique" UNIQUE ("databaseId", "filename")
);

CREATE INDEX IF NOT EXISTS "databaseMigration_databaseId_idx"
  ON "databaseMigration" ("databaseId");
