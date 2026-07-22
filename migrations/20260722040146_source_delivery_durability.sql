-- Create enum type "sourceDeliveryStatus"
CREATE TYPE "public"."sourceDeliveryStatus" AS ENUM ('received', 'dispatching', 'dispatched', 'failed');
-- Create enum type "sourceWebhookStatus"
CREATE TYPE "public"."sourceWebhookStatus" AS ENUM ('unmanaged', 'verified', 'failed');
-- Modify "release" table
ALTER TABLE "public"."release" ALTER COLUMN "executionGeneration" DROP DEFAULT;
-- Modify "aiPluginRun" table
ALTER TABLE "public"."aiPluginRun" DROP CONSTRAINT "aiPluginRun_actorUserId_fkey", ADD CONSTRAINT "aiPluginRun_actorUserId_user_id_fk" FOREIGN KEY ("actorUserId") REFERENCES "public"."user" ("id") ON UPDATE NO ACTION ON DELETE SET NULL;
-- Modify "outboxMessage" table
ALTER TABLE "public"."outboxMessage" DROP CONSTRAINT "outboxMessage_createdByUserId_fk", DROP CONSTRAINT "outboxMessage_replayMessageId_fk", DROP CONSTRAINT "outboxMessage_replayedFromId_fk", DROP CONSTRAINT "outboxMessage_resolvedByUserId_fk", ADD CONSTRAINT "outboxMessage_createdByUserId_user_id_fk" FOREIGN KEY ("createdByUserId") REFERENCES "public"."user" ("id") ON UPDATE NO ACTION ON DELETE SET NULL, ADD CONSTRAINT "outboxMessage_replayMessageId_outboxMessage_id_fk" FOREIGN KEY ("replayMessageId") REFERENCES "public"."outboxMessage" ("id") ON UPDATE NO ACTION ON DELETE SET NULL, ADD CONSTRAINT "outboxMessage_replayedFromId_outboxMessage_id_fk" FOREIGN KEY ("replayedFromId") REFERENCES "public"."outboxMessage" ("id") ON UPDATE NO ACTION ON DELETE SET NULL, ADD CONSTRAINT "outboxMessage_resolvedByUserId_user_id_fk" FOREIGN KEY ("resolvedByUserId") REFERENCES "public"."user" ("id") ON UPDATE NO ACTION ON DELETE SET NULL;
-- Modify "repository" table
ALTER TABLE "public"."repository" ADD COLUMN "sourceWebhookId" character varying(255) NULL, ADD COLUMN "sourceWebhookUrl" character varying(500) NULL, ADD COLUMN "sourceWebhookStatus" "public"."sourceWebhookStatus" NOT NULL DEFAULT 'unmanaged', ADD COLUMN "sourceWebhookVerifiedAt" timestamp NULL, ADD COLUMN "sourceWebhookLastError" text NULL;
-- Create "sourceDelivery" table
CREATE TABLE "public"."sourceDelivery" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "projectId" uuid NOT NULL,
  "repositoryId" uuid NOT NULL,
  "provider" "public"."gitProviderType" NOT NULL,
  "providerDeliveryId" character varying(255) NOT NULL,
  "sourceRepository" character varying(255) NOT NULL,
  "sourceRef" character varying(255) NOT NULL,
  "beforeCommitSha" character varying(100) NULL,
  "sourceCommitSha" character varying(100) NOT NULL,
  "forceFullBuild" boolean NOT NULL DEFAULT false,
  "status" "public"."sourceDeliveryStatus" NOT NULL DEFAULT 'received',
  "attemptCount" integer NOT NULL DEFAULT 0,
  "lastError" text NULL,
  "dispatchedAt" timestamp NULL,
  "createdAt" timestamp NOT NULL DEFAULT now(),
  "updatedAt" timestamp NOT NULL DEFAULT now(),
  PRIMARY KEY ("id"),
  CONSTRAINT "sourceDelivery_provider_delivery_unique" UNIQUE ("provider", "providerDeliveryId"),
  CONSTRAINT "sourceDelivery_projectId_project_id_fk" FOREIGN KEY ("projectId") REFERENCES "public"."project" ("id") ON UPDATE NO ACTION ON DELETE CASCADE,
  CONSTRAINT "sourceDelivery_repositoryId_repository_id_fk" FOREIGN KEY ("repositoryId") REFERENCES "public"."repository" ("id") ON UPDATE NO ACTION ON DELETE CASCADE
);
-- Create index "sourceDelivery_projectId_idx" to table: "sourceDelivery"
CREATE INDEX "sourceDelivery_projectId_idx" ON "public"."sourceDelivery" ("projectId");
-- Create index "sourceDelivery_repositoryId_idx" to table: "sourceDelivery"
CREATE INDEX "sourceDelivery_repositoryId_idx" ON "public"."sourceDelivery" ("repositoryId");
-- Create index "sourceDelivery_status_idx" to table: "sourceDelivery"
CREATE INDEX "sourceDelivery_status_idx" ON "public"."sourceDelivery" ("status");
