CREATE TYPE "public"."migrationReleaseStage" AS ENUM(
  'standard',
  'expand',
  'backfill',
  'verify',
  'contract'
);
--> statement-breakpoint
CREATE TYPE "public"."releaseMigrationPlanStatus" AS ENUM(
  'awaiting_approval',
  'approved',
  'executing',
  'completed',
  'failed',
  'superseded'
);
--> statement-breakpoint
ALTER TABLE "migrationSpecification"
ADD COLUMN "releaseStage" "migrationReleaseStage" DEFAULT 'standard' NOT NULL,
ADD COLUMN "stageOrder" integer DEFAULT 0 NOT NULL,
ADD COLUMN "targetVersion" varchar(100),
ADD COLUMN "baselineVersion" varchar(100);
--> statement-breakpoint
ALTER TABLE "migrationSpecification"
DROP CONSTRAINT "migrationSpecification_service_env_db_unique";
--> statement-breakpoint
ALTER TABLE "migrationSpecification"
ADD CONSTRAINT "migrationSpecification_service_env_db_stage_unique"
UNIQUE("serviceId", "environmentId", "databaseId", "releaseStage");
--> statement-breakpoint
ALTER TABLE "migrationRun"
ADD COLUMN "releaseStage" "migrationReleaseStage" DEFAULT 'standard' NOT NULL,
ADD COLUMN "stageOrder" integer DEFAULT 0 NOT NULL,
ADD COLUMN "targetVersion" varchar(100),
ADD COLUMN "baselineVersion" varchar(100),
ADD COLUMN "specificationSnapshot" jsonb;
--> statement-breakpoint
UPDATE "migrationRun" AS run
SET "specificationSnapshot" = jsonb_build_object(
  'source', specification."source",
  'tool', specification."tool",
  'phase', specification."phase",
  'executionMode', specification."executionMode",
  'releaseStage', specification."releaseStage",
  'stageOrder', specification."stageOrder",
  'targetVersion', specification."targetVersion",
  'baselineVersion', specification."baselineVersion",
  'sourceConfigPath', specification."sourceConfigPath",
  'migrationPath', specification."migrationPath",
  'command', specification."command",
  'lockStrategy', specification."lockStrategy",
  'compatibility', specification."compatibility",
  'approvalPolicy', specification."approvalPolicy"
)
FROM "migrationSpecification" AS specification
WHERE run."specificationId" = specification."id";
--> statement-breakpoint
ALTER TABLE "migrationRun"
ALTER COLUMN "specificationSnapshot" SET NOT NULL;
--> statement-breakpoint
CREATE TABLE "releaseMigrationPlan" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
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
  "updatedAt" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "releaseMigrationPlan_release_unique" UNIQUE("releaseId"),
  CONSTRAINT "releaseMigrationPlan_releaseId_release_id_fk"
    FOREIGN KEY ("releaseId") REFERENCES "public"."release"("id") ON DELETE CASCADE,
  CONSTRAINT "releaseMigrationPlan_projectId_project_id_fk"
    FOREIGN KEY ("projectId") REFERENCES "public"."project"("id") ON DELETE CASCADE,
  CONSTRAINT "releaseMigrationPlan_environmentId_environment_id_fk"
    FOREIGN KEY ("environmentId") REFERENCES "public"."environment"("id") ON DELETE CASCADE,
  CONSTRAINT "releaseMigrationPlan_approvedByUserId_user_id_fk"
    FOREIGN KEY ("approvedByUserId") REFERENCES "public"."user"("id") ON DELETE SET NULL
);
--> statement-breakpoint
CREATE INDEX "releaseMigrationPlan_projectId_idx" ON "releaseMigrationPlan" ("projectId");
--> statement-breakpoint
CREATE INDEX "releaseMigrationPlan_environmentId_idx" ON "releaseMigrationPlan" ("environmentId");
--> statement-breakpoint
CREATE INDEX "releaseMigrationPlan_status_idx" ON "releaseMigrationPlan" ("status");
--> statement-breakpoint
ALTER TABLE "migrationRun"
ADD COLUMN "releaseMigrationPlanId" uuid;
--> statement-breakpoint
ALTER TABLE "migrationRun"
ADD CONSTRAINT "migrationRun_releaseMigrationPlanId_releaseMigrationPlan_id_fk"
FOREIGN KEY ("releaseMigrationPlanId") REFERENCES "public"."releaseMigrationPlan"("id")
ON DELETE RESTRICT;
--> statement-breakpoint
CREATE INDEX "migrationRun_releaseMigrationPlanId_idx"
ON "migrationRun" ("releaseMigrationPlanId");
