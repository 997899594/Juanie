-- Create enum type "deliveryRuleKind"
CREATE TYPE "deliveryRuleKind" AS ENUM ('branch', 'tag', 'pull_request', 'manual');
-- Create enum type "environmentKind"
CREATE TYPE "environmentKind" AS ENUM ('production', 'persistent', 'preview');
-- Create enum type "promotionFlowStrategy"
CREATE TYPE "promotionFlowStrategy" AS ENUM ('reuse_release_artifacts', 'rebuild_from_ref');
-- Modify "environment" table
ALTER TABLE "environment" ADD COLUMN "kind" "environmentKind" NOT NULL DEFAULT 'persistent';
UPDATE "environment"
SET "kind" = CASE
  WHEN "isPreview" = true THEN 'preview'::"environmentKind"
  WHEN "isProduction" = true THEN 'production'::"environmentKind"
  ELSE 'persistent'::"environmentKind"
END;
-- Create "deliveryRule" table
CREATE TABLE "deliveryRule" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "projectId" uuid NOT NULL, "environmentId" uuid NULL, "kind" "deliveryRuleKind" NOT NULL, "pattern" character varying(255) NULL, "isActive" boolean NOT NULL DEFAULT true, "priority" integer NOT NULL DEFAULT 100, "autoCreateEnvironment" boolean NOT NULL DEFAULT false, "createdAt" timestamp NOT NULL DEFAULT now(), "updatedAt" timestamp NOT NULL DEFAULT now(), PRIMARY KEY ("id"), CONSTRAINT "deliveryRule_environmentId_environment_id_fk" FOREIGN KEY ("environmentId") REFERENCES "environment" ("id") ON UPDATE NO ACTION ON DELETE CASCADE, CONSTRAINT "deliveryRule_projectId_project_id_fk" FOREIGN KEY ("projectId") REFERENCES "project" ("id") ON UPDATE NO ACTION ON DELETE CASCADE);
-- Create index "deliveryRule_environmentId_idx" to table: "deliveryRule"
CREATE INDEX "deliveryRule_environmentId_idx" ON "deliveryRule" ("environmentId");
-- Create index "deliveryRule_kind_priority_idx" to table: "deliveryRule"
CREATE INDEX "deliveryRule_kind_priority_idx" ON "deliveryRule" ("projectId", "kind", "priority");
-- Create index "deliveryRule_projectId_idx" to table: "deliveryRule"
CREATE INDEX "deliveryRule_projectId_idx" ON "deliveryRule" ("projectId");
-- Create "promotionFlow" table
CREATE TABLE "promotionFlow" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "projectId" uuid NOT NULL, "sourceEnvironmentId" uuid NOT NULL, "targetEnvironmentId" uuid NOT NULL, "requiresApproval" boolean NOT NULL DEFAULT true, "strategy" "promotionFlowStrategy" NOT NULL DEFAULT 'reuse_release_artifacts', "isActive" boolean NOT NULL DEFAULT true, "createdAt" timestamp NOT NULL DEFAULT now(), "updatedAt" timestamp NOT NULL DEFAULT now(), PRIMARY KEY ("id"), CONSTRAINT "promotionFlow_source_target_unique" UNIQUE ("projectId", "sourceEnvironmentId", "targetEnvironmentId"), CONSTRAINT "promotionFlow_projectId_project_id_fk" FOREIGN KEY ("projectId") REFERENCES "project" ("id") ON UPDATE NO ACTION ON DELETE CASCADE, CONSTRAINT "promotionFlow_sourceEnvironmentId_environment_id_fk" FOREIGN KEY ("sourceEnvironmentId") REFERENCES "environment" ("id") ON UPDATE NO ACTION ON DELETE CASCADE, CONSTRAINT "promotionFlow_targetEnvironmentId_environment_id_fk" FOREIGN KEY ("targetEnvironmentId") REFERENCES "environment" ("id") ON UPDATE NO ACTION ON DELETE CASCADE);
-- Create index "promotionFlow_projectId_idx" to table: "promotionFlow"
CREATE INDEX "promotionFlow_projectId_idx" ON "promotionFlow" ("projectId");
-- Create index "promotionFlow_sourceEnvironmentId_idx" to table: "promotionFlow"
CREATE INDEX "promotionFlow_sourceEnvironmentId_idx" ON "promotionFlow" ("sourceEnvironmentId");
-- Create index "promotionFlow_targetEnvironmentId_idx" to table: "promotionFlow"
CREATE INDEX "promotionFlow_targetEnvironmentId_idx" ON "promotionFlow" ("targetEnvironmentId");

INSERT INTO "deliveryRule" ("projectId", "environmentId", "kind", "pattern", "priority", "autoCreateEnvironment")
SELECT "projectId", "id", 'branch', "branch", 100, false
FROM "environment"
WHERE "branch" IS NOT NULL
  AND COALESCE("isPreview", false) = false;

INSERT INTO "deliveryRule" ("projectId", "environmentId", "kind", "pattern", "priority", "autoCreateEnvironment")
SELECT "projectId", "id", 'tag', "tagPattern", 100, false
FROM "environment"
WHERE "tagPattern" IS NOT NULL
  AND COALESCE("isPreview", false) = false;

WITH ranked_source AS (
  SELECT
    "projectId",
    "id" AS "environmentId",
    ROW_NUMBER() OVER (
      PARTITION BY "projectId"
      ORDER BY CASE WHEN "name" = 'staging' THEN 0 ELSE 1 END, "createdAt" ASC
    ) AS "rank"
  FROM "environment"
  WHERE "kind" = 'persistent'
    AND COALESCE("autoDeploy", false) = true
    AND COALESCE("isProduction", false) = false
),
target_environment AS (
  SELECT DISTINCT ON ("projectId")
    "projectId",
    "id" AS "environmentId"
  FROM "environment"
  WHERE "kind" = 'production'
     OR COALESCE("isProduction", false) = true
  ORDER BY "projectId", "createdAt" ASC
)
INSERT INTO "deliveryRule" ("projectId", "environmentId", "kind", "pattern", "priority", "autoCreateEnvironment")
SELECT
  source."projectId",
  source."environmentId",
  'pull_request',
  '*',
  100,
  true
FROM ranked_source AS source
WHERE source."rank" = 1;

WITH ranked_source AS (
  SELECT
    "projectId",
    "id" AS "environmentId",
    ROW_NUMBER() OVER (
      PARTITION BY "projectId"
      ORDER BY CASE WHEN "name" = 'staging' THEN 0 ELSE 1 END, "createdAt" ASC
    ) AS "rank"
  FROM "environment"
  WHERE "kind" = 'persistent'
    AND COALESCE("autoDeploy", false) = true
    AND COALESCE("isProduction", false) = false
),
target_environment AS (
  SELECT DISTINCT ON ("projectId")
    "projectId",
    "id" AS "environmentId"
  FROM "environment"
  WHERE "kind" = 'production'
     OR COALESCE("isProduction", false) = true
  ORDER BY "projectId", "createdAt" ASC
)
INSERT INTO "promotionFlow" (
  "projectId",
  "sourceEnvironmentId",
  "targetEnvironmentId",
  "requiresApproval",
  "strategy",
  "isActive"
)
SELECT
  source."projectId",
  source."environmentId",
  target."environmentId",
  true,
  'reuse_release_artifacts',
  true
FROM ranked_source AS source
INNER JOIN target_environment AS target
  ON target."projectId" = source."projectId"
WHERE source."rank" = 1;
