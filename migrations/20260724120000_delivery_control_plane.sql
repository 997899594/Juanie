-- Create durable delivery control-plane enums.
CREATE TYPE "public"."deliveryExecutionStatus" AS ENUM (
  'received', 'dispatching', 'building', 'staging_releasing', 'staging_verified',
  'awaiting_promotion', 'production_releasing', 'production_verified', 'failed', 'canceled'
);
CREATE TYPE "public"."promotionRequestStatus" AS ENUM (
  'requested', 'approved', 'rejected', 'executing', 'succeeded', 'failed', 'superseded'
);
CREATE TYPE "public"."repositoryWebhookReconcileStatus" AS ENUM (
  'pending', 'reconciling', 'in_sync', 'drifted', 'failed'
);

-- One aggregate follows a source change through production verification.
CREATE TABLE "public"."deliveryExecution" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "projectId" uuid NOT NULL,
  "repositoryId" uuid NOT NULL,
  "provider" "public"."gitProviderType" NOT NULL,
  "providerDeliveryId" character varying(255) NOT NULL,
  "sourceRepository" character varying(255) NOT NULL,
  "sourceRef" character varying(255) NOT NULL,
  "sourceCommitSha" character varying(100) NOT NULL,
  "status" "public"."deliveryExecutionStatus" NOT NULL DEFAULT 'received',
  "lastErrorCode" character varying(100) NULL,
  "lastError" text NULL,
  "lastSignalAt" timestamp NOT NULL DEFAULT now(),
  "startedAt" timestamp NOT NULL DEFAULT now(),
  "completedAt" timestamp NULL,
  "createdAt" timestamp NOT NULL DEFAULT now(),
  "updatedAt" timestamp NOT NULL DEFAULT now(),
  PRIMARY KEY ("id"),
  CONSTRAINT "deliveryExecution_provider_delivery_unique" UNIQUE ("provider", "providerDeliveryId"),
  CONSTRAINT "deliveryExecution_projectId_project_id_fk" FOREIGN KEY ("projectId") REFERENCES "public"."project" ("id") ON DELETE CASCADE,
  CONSTRAINT "deliveryExecution_repositoryId_repository_id_fk" FOREIGN KEY ("repositoryId") REFERENCES "public"."repository" ("id") ON DELETE CASCADE
);
CREATE INDEX "deliveryExecution_project_created_idx" ON "public"."deliveryExecution" ("projectId", "createdAt");
CREATE INDEX "deliveryExecution_status_signal_idx" ON "public"."deliveryExecution" ("status", "lastSignalAt");

CREATE TABLE "public"."deliveryExecutionEvent" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "sequence" bigserial NOT NULL,
  "deliveryExecutionId" uuid NOT NULL,
  "eventKey" character varying(255) NOT NULL,
  "type" character varying(100) NOT NULL,
  "fromStatus" "public"."deliveryExecutionStatus" NULL,
  "toStatus" "public"."deliveryExecutionStatus" NOT NULL,
  "data" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "occurredAt" timestamp NOT NULL DEFAULT now(),
  PRIMARY KEY ("id"),
  CONSTRAINT "deliveryExecutionEvent_execution_event_key_unique" UNIQUE ("deliveryExecutionId", "eventKey"),
  CONSTRAINT "deliveryExecutionEvent_deliveryExecutionId_deliveryExecution_id_fk" FOREIGN KEY ("deliveryExecutionId") REFERENCES "public"."deliveryExecution" ("id") ON DELETE CASCADE
);
CREATE INDEX "deliveryExecutionEvent_execution_sequence_idx" ON "public"."deliveryExecutionEvent" ("deliveryExecutionId", "sequence");

-- Existing source deliveries retain their ids as execution ids for continuous lineage.
INSERT INTO "public"."deliveryExecution" (
  "id", "projectId", "repositoryId", "provider", "providerDeliveryId", "sourceRepository",
  "sourceRef", "sourceCommitSha", "status", "lastError", "lastSignalAt", "startedAt",
  "completedAt", "createdAt", "updatedAt"
)
SELECT
  "id", "projectId", "repositoryId", "provider", "providerDeliveryId", "sourceRepository",
  "sourceRef", "sourceCommitSha",
  CASE
    WHEN "status" = 'failed' THEN 'failed'::"public"."deliveryExecutionStatus"
    WHEN "status" = 'dispatched' THEN 'dispatching'::"public"."deliveryExecutionStatus"
    ELSE "status"::text::"public"."deliveryExecutionStatus"
  END,
  "lastError", "updatedAt", "createdAt",
  CASE WHEN "status" = 'failed' THEN "updatedAt" ELSE NULL END,
  "createdAt", "updatedAt"
FROM "public"."sourceDelivery"
ON CONFLICT ("provider", "providerDeliveryId") DO NOTHING;

INSERT INTO "public"."deliveryExecutionEvent" (
  "deliveryExecutionId", "eventKey", "type", "fromStatus", "toStatus", "data", "occurredAt"
)
SELECT
  "id", 'source.received', 'source.received', NULL, 'received',
  jsonb_build_object('providerDeliveryId', "providerDeliveryId", 'sourceCommitSha', "sourceCommitSha"),
  "createdAt"
FROM "public"."sourceDelivery"
ON CONFLICT ("deliveryExecutionId", "eventKey") DO NOTHING;

ALTER TABLE "public"."sourceDelivery" ADD COLUMN "deliveryExecutionId" uuid NULL;
UPDATE "public"."sourceDelivery" SET "deliveryExecutionId" = "id";
ALTER TABLE "public"."sourceDelivery" ALTER COLUMN "deliveryExecutionId" SET NOT NULL;
ALTER TABLE "public"."sourceDelivery" ADD CONSTRAINT "sourceDelivery_deliveryExecutionId_deliveryExecution_id_fk" FOREIGN KEY ("deliveryExecutionId") REFERENCES "public"."deliveryExecution" ("id") ON DELETE CASCADE;
ALTER TABLE "public"."sourceDelivery" ADD CONSTRAINT "sourceDelivery_deliveryExecution_unique" UNIQUE ("deliveryExecutionId");

ALTER TABLE "public"."buildRun" ADD COLUMN "deliveryExecutionId" uuid NULL;
UPDATE "public"."buildRun" b
SET "deliveryExecutionId" = e."id"
FROM "public"."deliveryExecution" e
WHERE b."repositoryId" = e."repositoryId"
  AND b."provider" = e."provider"::text
  AND b."externalRunId" = e."providerDeliveryId";
ALTER TABLE "public"."buildRun" ADD CONSTRAINT "buildRun_deliveryExecutionId_deliveryExecution_id_fk" FOREIGN KEY ("deliveryExecutionId") REFERENCES "public"."deliveryExecution" ("id") ON DELETE SET NULL;
CREATE INDEX "buildRun_deliveryExecution_idx" ON "public"."buildRun" ("deliveryExecutionId");

ALTER TABLE "public"."release" ADD COLUMN "deliveryExecutionId" uuid NULL;
UPDATE "public"."release" r
SET "deliveryExecutionId" = b."deliveryExecutionId"
FROM "public"."buildRun" b
WHERE r."id" = b."releaseId" AND b."deliveryExecutionId" IS NOT NULL;
UPDATE "public"."release" target
SET "deliveryExecutionId" = source."deliveryExecutionId"
FROM "public"."release" source
WHERE target."sourceReleaseId" = source."id" AND target."deliveryExecutionId" IS NULL;
ALTER TABLE "public"."release" ADD CONSTRAINT "release_deliveryExecutionId_deliveryExecution_id_fk" FOREIGN KEY ("deliveryExecutionId") REFERENCES "public"."deliveryExecution" ("id") ON DELETE SET NULL;
CREATE INDEX "release_deliveryExecution_idx" ON "public"."release" ("deliveryExecutionId");

CREATE TABLE "public"."promotionRequest" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "deliveryExecutionId" uuid NULL,
  "projectId" uuid NOT NULL,
  "sourceReleaseId" uuid NOT NULL,
  "targetEnvironmentId" uuid NOT NULL,
  "productionReleaseId" uuid NULL,
  "status" "public"."promotionRequestStatus" NOT NULL DEFAULT 'requested',
  "contentDigest" character varying(71) NOT NULL,
  "content" jsonb NOT NULL,
  "requireDistinctApprover" boolean NOT NULL DEFAULT false,
  "requestedByUserId" uuid NULL,
  "approvedByUserId" uuid NULL,
  "requestedAt" timestamp NOT NULL DEFAULT now(),
  "approvedAt" timestamp NULL,
  "completedAt" timestamp NULL,
  "lastError" text NULL,
  "createdAt" timestamp NOT NULL DEFAULT now(),
  "updatedAt" timestamp NOT NULL DEFAULT now(),
  PRIMARY KEY ("id"),
  CONSTRAINT "promotionRequest_source_target_digest_unique" UNIQUE ("sourceReleaseId", "targetEnvironmentId", "contentDigest"),
  CONSTRAINT "promotionRequest_deliveryExecutionId_deliveryExecution_id_fk" FOREIGN KEY ("deliveryExecutionId") REFERENCES "public"."deliveryExecution" ("id") ON DELETE SET NULL,
  CONSTRAINT "promotionRequest_projectId_project_id_fk" FOREIGN KEY ("projectId") REFERENCES "public"."project" ("id") ON DELETE CASCADE,
  CONSTRAINT "promotionRequest_sourceReleaseId_release_id_fk" FOREIGN KEY ("sourceReleaseId") REFERENCES "public"."release" ("id") ON DELETE RESTRICT,
  CONSTRAINT "promotionRequest_targetEnvironmentId_environment_id_fk" FOREIGN KEY ("targetEnvironmentId") REFERENCES "public"."environment" ("id") ON DELETE RESTRICT,
  CONSTRAINT "promotionRequest_productionReleaseId_release_id_fk" FOREIGN KEY ("productionReleaseId") REFERENCES "public"."release" ("id") ON DELETE SET NULL,
  CONSTRAINT "promotionRequest_requestedByUserId_user_id_fk" FOREIGN KEY ("requestedByUserId") REFERENCES "public"."user" ("id") ON DELETE SET NULL,
  CONSTRAINT "promotionRequest_approvedByUserId_user_id_fk" FOREIGN KEY ("approvedByUserId") REFERENCES "public"."user" ("id") ON DELETE SET NULL
);
CREATE INDEX "promotionRequest_project_created_idx" ON "public"."promotionRequest" ("projectId", "createdAt");
CREATE INDEX "promotionRequest_deliveryExecution_idx" ON "public"."promotionRequest" ("deliveryExecutionId");

CREATE TABLE "public"."promotionApprovalEvent" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "promotionRequestId" uuid NOT NULL,
  "action" character varying(20) NOT NULL,
  "contentDigest" character varying(71) NOT NULL,
  "actorUserId" uuid NULL,
  "reason" text NULL,
  "createdAt" timestamp NOT NULL DEFAULT now(),
  PRIMARY KEY ("id"),
  CONSTRAINT "promotionApprovalEvent_promotionRequestId_promotionRequest_id_fk" FOREIGN KEY ("promotionRequestId") REFERENCES "public"."promotionRequest" ("id") ON DELETE CASCADE,
  CONSTRAINT "promotionApprovalEvent_actorUserId_user_id_fk" FOREIGN KEY ("actorUserId") REFERENCES "public"."user" ("id") ON DELETE SET NULL
);
CREATE INDEX "promotionApprovalEvent_request_created_idx" ON "public"."promotionApprovalEvent" ("promotionRequestId", "createdAt");

ALTER TABLE "public"."release" ADD COLUMN "promotionRequestId" uuid NULL;
ALTER TABLE "public"."release" ADD CONSTRAINT "release_promotionRequestId_promotionRequest_id_fk" FOREIGN KEY ("promotionRequestId") REFERENCES "public"."promotionRequest" ("id") ON DELETE SET NULL;
CREATE INDEX "release_promotionRequest_idx" ON "public"."release" ("promotionRequestId");

CREATE TABLE "public"."repositoryWebhookController" (
  "repositoryId" uuid NOT NULL,
  "desiredGeneration" integer NOT NULL DEFAULT 1,
  "observedGeneration" integer NOT NULL DEFAULT 0,
  "canonicalUrl" character varying(500) NOT NULL,
  "observedWebhookId" character varying(255) NULL,
  "observedUrl" character varying(500) NULL,
  "status" "public"."repositoryWebhookReconcileStatus" NOT NULL DEFAULT 'pending',
  "attemptCount" integer NOT NULL DEFAULT 0,
  "retryAt" timestamp NULL,
  "lastErrorCode" character varying(100) NULL,
  "lastError" text NULL,
  "lastReconciledAt" timestamp NULL,
  "createdAt" timestamp NOT NULL DEFAULT now(),
  "updatedAt" timestamp NOT NULL DEFAULT now(),
  PRIMARY KEY ("repositoryId"),
  CONSTRAINT "repositoryWebhookController_repositoryId_repository_id_fk" FOREIGN KEY ("repositoryId") REFERENCES "public"."repository" ("id") ON DELETE CASCADE
);
CREATE INDEX "repositoryWebhookController_reconcile_idx" ON "public"."repositoryWebhookController" ("status", "retryAt");
INSERT INTO "public"."repositoryWebhookController" (
  "repositoryId", "canonicalUrl", "observedWebhookId", "observedUrl", "status", "observedGeneration"
)
SELECT DISTINCT
  r."id", COALESCE(r."sourceWebhookUrl", 'https://juanie.art/api/webhooks/source'),
  r."sourceWebhookId", r."sourceWebhookUrl",
  CASE WHEN r."sourceWebhookStatus" = 'verified' THEN 'in_sync'::"public"."repositoryWebhookReconcileStatus" ELSE 'pending'::"public"."repositoryWebhookReconcileStatus" END,
  CASE WHEN r."sourceWebhookStatus" = 'verified' THEN 1 ELSE 0 END
FROM "public"."repository" r
JOIN "public"."project" p ON p."repositoryId" = r."id" AND p."status" = 'active'
ON CONFLICT ("repositoryId") DO NOTHING;

ALTER TABLE "public"."deployment" ADD COLUMN "deliveryExecutionId" uuid NULL;
ALTER TABLE "public"."deployment" ADD COLUMN "imageDigest" character varying(255) NULL;
UPDATE "public"."deployment" d
SET "deliveryExecutionId" = r."deliveryExecutionId"
FROM "public"."release" r
WHERE d."releaseId" = r."id";
ALTER TABLE "public"."deployment" ADD CONSTRAINT "deployment_deliveryExecutionId_deliveryExecution_id_fk" FOREIGN KEY ("deliveryExecutionId") REFERENCES "public"."deliveryExecution" ("id") ON DELETE SET NULL;
CREATE INDEX "deployment_deliveryExecution_idx" ON "public"."deployment" ("deliveryExecutionId");
