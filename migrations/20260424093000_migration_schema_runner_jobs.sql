ALTER TYPE "public"."migrationRunnerType" ADD VALUE IF NOT EXISTS 'schema_runner';
--> statement-breakpoint
ALTER TYPE "public"."migrationRunnerType" ADD VALUE IF NOT EXISTS 'external';
--> statement-breakpoint
ALTER TABLE "migrationRun"
ADD COLUMN "jobName" varchar(255);
