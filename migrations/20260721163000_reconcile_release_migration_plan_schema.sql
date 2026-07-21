-- Converge databases that applied either published form of 20260714120000.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type
    INNER JOIN pg_namespace ON pg_namespace.oid = pg_type.typnamespace
    WHERE pg_namespace.nspname = 'public'
      AND pg_type.typname = 'releaseMigrationPlanStatus'
  ) THEN
    CREATE TYPE "public"."releaseMigrationPlanStatus" AS ENUM(
      'awaiting_approval',
      'approved',
      'executing',
      'completed',
      'failed',
      'superseded'
    );
  END IF;
END
$$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "releaseMigrationPlan" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "releaseId" uuid NOT NULL,
  "projectId" uuid NOT NULL,
  "environmentId" uuid NOT NULL,
  "sourceCommitSha" varchar(100) NOT NULL,
  "digest" varchar(64) NOT NULL,
  "snapshot" jsonb NOT NULL,
  "status" "releaseMigrationPlanStatus" NOT NULL,
  "requiresApproval" boolean NOT NULL,
  "approvedDigest" varchar(64),
  "approvedByUserId" uuid,
  "approvedAt" timestamp,
  "createdAt" timestamp DEFAULT now() NOT NULL,
  "updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = '"releaseMigrationPlan"'::regclass
      AND conname = 'releaseMigrationPlan_pkey'
  ) THEN
    ALTER TABLE "releaseMigrationPlan"
      ADD CONSTRAINT "releaseMigrationPlan_pkey" PRIMARY KEY ("id");
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = '"releaseMigrationPlan"'::regclass
      AND conname = 'releaseMigrationPlan_release_unique'
  ) THEN
    ALTER TABLE "releaseMigrationPlan"
      ADD CONSTRAINT "releaseMigrationPlan_release_unique" UNIQUE ("releaseId");
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = '"releaseMigrationPlan"'::regclass
      AND conname = 'releaseMigrationPlan_releaseId_release_id_fk'
  ) THEN
    ALTER TABLE "releaseMigrationPlan"
      ADD CONSTRAINT "releaseMigrationPlan_releaseId_release_id_fk"
      FOREIGN KEY ("releaseId") REFERENCES "release"("id") ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = '"releaseMigrationPlan"'::regclass
      AND conname = 'releaseMigrationPlan_projectId_project_id_fk'
  ) THEN
    ALTER TABLE "releaseMigrationPlan"
      ADD CONSTRAINT "releaseMigrationPlan_projectId_project_id_fk"
      FOREIGN KEY ("projectId") REFERENCES "project"("id") ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = '"releaseMigrationPlan"'::regclass
      AND conname = 'releaseMigrationPlan_environmentId_environment_id_fk'
  ) THEN
    ALTER TABLE "releaseMigrationPlan"
      ADD CONSTRAINT "releaseMigrationPlan_environmentId_environment_id_fk"
      FOREIGN KEY ("environmentId") REFERENCES "environment"("id") ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = '"releaseMigrationPlan"'::regclass
      AND conname = 'releaseMigrationPlan_approvedByUserId_user_id_fk'
  ) THEN
    ALTER TABLE "releaseMigrationPlan"
      ADD CONSTRAINT "releaseMigrationPlan_approvedByUserId_user_id_fk"
      FOREIGN KEY ("approvedByUserId") REFERENCES "user"("id") ON DELETE SET NULL;
  END IF;
END
$$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "releaseMigrationPlan_projectId_idx"
ON "releaseMigrationPlan" ("projectId");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "releaseMigrationPlan_environmentId_idx"
ON "releaseMigrationPlan" ("environmentId");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "releaseMigrationPlan_status_idx"
ON "releaseMigrationPlan" ("status");
--> statement-breakpoint
ALTER TABLE "migrationRun"
ADD COLUMN IF NOT EXISTS "releaseMigrationPlanId" uuid;
--> statement-breakpoint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = '"migrationRun"'::regclass
      AND conname = 'migrationRun_releaseMigrationPlanId_releaseMigrationPlan_id_fk'
  ) THEN
    ALTER TABLE "migrationRun"
      ADD CONSTRAINT "migrationRun_releaseMigrationPlanId_releaseMigrationPlan_id_fk"
      FOREIGN KEY ("releaseMigrationPlanId") REFERENCES "releaseMigrationPlan"("id")
      ON DELETE RESTRICT;
  END IF;
END
$$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "migrationRun_releaseMigrationPlanId_idx"
ON "migrationRun" ("releaseMigrationPlanId");
--> statement-breakpoint
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "environmentSchemaState"
    GROUP BY "databaseId"
    HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'environment schema state contains duplicate database identities';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = '"environmentSchemaState"'::regclass
      AND conname = 'environmentSchemaState_database_unique'
  ) THEN
    ALTER TABLE "environmentSchemaState"
      ADD CONSTRAINT "environmentSchemaState_database_unique" UNIQUE ("databaseId");
  END IF;
END
$$;
