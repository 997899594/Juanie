UPDATE "migrationRun"
SET "runnerType" = 'worker'
WHERE "runnerType" <> 'worker';
--> statement-breakpoint
ALTER TABLE "migrationSpecification" DROP COLUMN IF EXISTS "workingDirectory";
--> statement-breakpoint
ALTER TYPE "migrationRunnerType" RENAME TO "migrationRunnerType_old";
--> statement-breakpoint
CREATE TYPE "migrationRunnerType" AS ENUM('worker');
--> statement-breakpoint
ALTER TABLE "migrationRun"
  ALTER COLUMN "runnerType" DROP DEFAULT,
  ALTER COLUMN "runnerType" TYPE "migrationRunnerType" USING 'worker'::"migrationRunnerType",
  ALTER COLUMN "runnerType" SET DEFAULT 'worker';
--> statement-breakpoint
DROP TYPE "migrationRunnerType_old";
