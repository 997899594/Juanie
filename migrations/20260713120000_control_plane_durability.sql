-- Refuse to install stronger invariants over ambiguous control-plane state.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM "teamMember" GROUP BY "teamId", "userId" HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'duplicate team memberships must be resolved before migration';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM "teamIntegrationBinding"
    WHERE "revokedAt" IS NULL
    GROUP BY "teamId", "integrationIdentityId"
    HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'duplicate active team integration bindings must be resolved before migration';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM "teamIntegrationBinding"
    WHERE "revokedAt" IS NULL AND "isDefault" = true
    GROUP BY "teamId"
    HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'multiple active default team integration bindings must be resolved before migration';
  END IF;

  IF EXISTS (SELECT 1 FROM "project" GROUP BY "slug" HAVING count(*) > 1) THEN
    RAISE EXCEPTION 'duplicate project slugs must be resolved before migration';
  END IF;

  IF EXISTS (
    SELECT 1 FROM "projectInitStep" GROUP BY "projectId", "step" HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'duplicate project initialization steps must be resolved before migration';
  END IF;

  IF EXISTS (SELECT 1 FROM "service" GROUP BY "projectId", "name" HAVING count(*) > 1) THEN
    RAISE EXCEPTION 'duplicate project service names must be resolved before migration';
  END IF;

  IF EXISTS (SELECT 1 FROM "environment" GROUP BY "projectId", "name" HAVING count(*) > 1) THEN
    RAISE EXCEPTION 'duplicate project environment names must be resolved before migration';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM "environment"
    WHERE "previewPrNumber" IS NOT NULL
    GROUP BY "projectId", "previewPrNumber"
    HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'duplicate preview pull request environments must be resolved before migration';
  END IF;

  IF EXISTS (SELECT 1 FROM "domain" GROUP BY "hostname" HAVING count(*) > 1) THEN
    RAISE EXCEPTION 'duplicate domain hostnames must be resolved before migration';
  END IF;
END
$$;

CREATE TYPE "outboxStatus" AS ENUM (
  'pending',
  'dispatching',
  'delivered',
  'failed',
  'dead_letter'
);

ALTER TABLE "teamMember"
  ADD CONSTRAINT "teamMember_team_user_unique" UNIQUE ("teamId", "userId");

ALTER TABLE "integration_grant"
  ALTER COLUMN "accessToken" DROP NOT NULL,
  ADD COLUMN "accessTokenEncrypted" text,
  ADD COLUMN "accessTokenIv" varchar(64),
  ADD COLUMN "accessTokenAuthTag" varchar(64),
  ADD COLUMN "refreshTokenEncrypted" text,
  ADD COLUMN "refreshTokenIv" varchar(64),
  ADD COLUMN "refreshTokenAuthTag" varchar(64),
  ADD COLUMN "encryptionKeyVersion" integer;

CREATE UNIQUE INDEX "teamIntegrationBinding_active_identity_unique"
  ON "teamIntegrationBinding" ("teamId", "integrationIdentityId")
  WHERE "revokedAt" IS NULL;

CREATE UNIQUE INDEX "teamIntegrationBinding_active_default_unique"
  ON "teamIntegrationBinding" ("teamId")
  WHERE "revokedAt" IS NULL AND "isDefault" = true;

DROP INDEX "project_slug_idx";
CREATE UNIQUE INDEX "project_slug_idx" ON "project" ("slug");

ALTER TABLE "projectInitStep"
  ADD CONSTRAINT "projectInitStep_project_step_unique" UNIQUE ("projectId", "step");

ALTER TABLE "service"
  ADD CONSTRAINT "service_project_name_unique" UNIQUE ("projectId", "name");

ALTER TABLE "environment"
  ADD CONSTRAINT "environment_project_name_unique" UNIQUE ("projectId", "name");

CREATE UNIQUE INDEX "environment_project_preview_pr_unique"
  ON "environment" ("projectId", "previewPrNumber")
  WHERE "previewPrNumber" IS NOT NULL;

DROP INDEX "domain_hostname_idx";
CREATE UNIQUE INDEX "domain_hostname_idx" ON "domain" ("hostname");

CREATE TABLE "releaseEvent" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "sequence" bigserial NOT NULL,
  "releaseId" uuid NOT NULL,
  "projectId" uuid NOT NULL,
  "environmentId" uuid NOT NULL,
  "actorUserId" uuid,
  "eventKey" varchar(255) NOT NULL,
  "type" varchar(100) NOT NULL,
  "data" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "correlationId" varchar(255) NOT NULL,
  "causationId" varchar(255),
  "occurredAt" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "releaseEvent_releaseId_release_id_fk"
    FOREIGN KEY ("releaseId") REFERENCES "release"("id") ON DELETE cascade,
  CONSTRAINT "releaseEvent_projectId_project_id_fk"
    FOREIGN KEY ("projectId") REFERENCES "project"("id") ON DELETE cascade,
  CONSTRAINT "releaseEvent_environmentId_environment_id_fk"
    FOREIGN KEY ("environmentId") REFERENCES "environment"("id") ON DELETE cascade,
  CONSTRAINT "releaseEvent_actorUserId_user_id_fk"
    FOREIGN KEY ("actorUserId") REFERENCES "user"("id") ON DELETE set null,
  CONSTRAINT "releaseEvent_release_event_key_unique" UNIQUE ("releaseId", "eventKey")
);

CREATE INDEX "releaseEvent_release_sequence_idx"
  ON "releaseEvent" ("releaseId", "sequence");
CREATE INDEX "releaseEvent_project_occurred_at_idx"
  ON "releaseEvent" ("projectId", "occurredAt");
CREATE INDEX "releaseEvent_correlation_id_idx"
  ON "releaseEvent" ("correlationId");

INSERT INTO "releaseEvent" (
  "releaseId", "projectId", "environmentId", "actorUserId", "eventKey", "type", "data",
  "correlationId", "occurredAt"
)
SELECT id, "projectId", "environmentId", "triggeredByUserId", 'created', 'release.created',
       jsonb_build_object('sourceRef', "sourceRef", 'sourceCommitSha', "sourceCommitSha"),
       id::text, "createdAt"
FROM "release";

INSERT INTO "releaseEvent" (
  "releaseId", "projectId", "environmentId", "eventKey", "type", "data", "correlationId",
  "occurredAt"
)
SELECT id, "projectId", "environmentId", 'status:backfill:' || status::text,
       'release.status.changed', jsonb_build_object('from', 'unknown', 'to', status::text,
       'errorMessage', "errorMessage"), id::text, "updatedAt"
FROM "release"
WHERE status <> 'queued';

CREATE TABLE "outboxMessage" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "topic" varchar(100) NOT NULL,
  "aggregateType" varchar(50) NOT NULL,
  "aggregateId" varchar(255) NOT NULL,
  "commandId" varchar(255) NOT NULL,
  "dedupeKey" varchar(700) NOT NULL,
  "payload" jsonb NOT NULL,
  "status" "outboxStatus" DEFAULT 'pending' NOT NULL,
  "attemptCount" integer DEFAULT 0 NOT NULL,
  "availableAt" timestamp DEFAULT now() NOT NULL,
  "claimedAt" timestamp,
  "claimedBy" varchar(255),
  "deliveredAt" timestamp,
  "lastError" text,
  "createdAt" timestamp DEFAULT now() NOT NULL,
  "updatedAt" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "outboxMessage_dedupe_key_unique" UNIQUE ("dedupeKey")
);

CREATE INDEX "outboxMessage_dispatch_idx"
  ON "outboxMessage" ("status", "availableAt");
CREATE INDEX "outboxMessage_aggregate_idx"
  ON "outboxMessage" ("aggregateType", "aggregateId");

CREATE TABLE "aiTokenBudget" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "teamId" uuid NOT NULL,
  "periodStart" timestamp NOT NULL,
  "limitTokens" integer NOT NULL,
  "consumedTokens" integer DEFAULT 0 NOT NULL,
  "reservedTokens" integer DEFAULT 0 NOT NULL,
  "createdAt" timestamp DEFAULT now() NOT NULL,
  "updatedAt" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "aiTokenBudget_teamId_team_id_fk"
    FOREIGN KEY ("teamId") REFERENCES "team"("id") ON DELETE cascade,
  CONSTRAINT "aiTokenBudget_team_period_unique" UNIQUE ("teamId", "periodStart")
);

CREATE TABLE "aiTokenReservation" (
  "id" uuid PRIMARY KEY NOT NULL,
  "teamId" uuid NOT NULL,
  "periodStart" timestamp NOT NULL,
  "reservedTokens" integer NOT NULL,
  "consumedTokens" integer,
  "status" varchar(20) DEFAULT 'pending' NOT NULL,
  "createdAt" timestamp DEFAULT now() NOT NULL,
  "settledAt" timestamp,
  CONSTRAINT "aiTokenReservation_teamId_team_id_fk"
    FOREIGN KEY ("teamId") REFERENCES "team"("id") ON DELETE cascade
);

CREATE INDEX "aiTokenReservation_team_period_idx"
  ON "aiTokenReservation" ("teamId", "periodStart");
