CREATE TYPE "public"."migrationReleaseStage" AS ENUM(
  'standard',
  'expand',
  'backfill',
  'verify',
  'contract'
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
