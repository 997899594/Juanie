ALTER TYPE "public"."migrationTool" ADD VALUE IF NOT EXISTS 'atlas';

ALTER TABLE "migrationSpecification"
ADD COLUMN "source" "migrationTool",
ADD COLUMN "sourceConfigPath" varchar(500);

UPDATE "migrationSpecification"
SET "source" = "tool"
WHERE "source" IS NULL;

ALTER TABLE "migrationSpecification"
ALTER COLUMN "source" SET DEFAULT 'custom',
ALTER COLUMN "source" SET NOT NULL;
