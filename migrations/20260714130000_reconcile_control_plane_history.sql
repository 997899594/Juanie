-- juanie:history-reconciliation-through 20260714120000
-- Reconciles an out-of-order production lineage before the next append-only revision.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM "teamMember" GROUP BY "teamId", "userId" HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'duplicate team memberships must be resolved before reconciliation';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM "teamIntegrationBinding"
    WHERE "revokedAt" IS NULL
    GROUP BY "teamId", "integrationIdentityId"
    HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'duplicate active team integration bindings must be resolved before reconciliation';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM "teamIntegrationBinding"
    WHERE "revokedAt" IS NULL AND "isDefault" = true
    GROUP BY "teamId"
    HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'multiple active default team integration bindings must be resolved before reconciliation';
  END IF;

  IF EXISTS (SELECT 1 FROM "project" GROUP BY "slug" HAVING count(*) > 1) THEN
    RAISE EXCEPTION 'duplicate project slugs must be resolved before reconciliation';
  END IF;

  IF EXISTS (
    SELECT 1 FROM "projectInitStep" GROUP BY "projectId", "step" HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'duplicate project initialization steps must be resolved before reconciliation';
  END IF;

  IF EXISTS (SELECT 1 FROM "service" GROUP BY "projectId", "name" HAVING count(*) > 1) THEN
    RAISE EXCEPTION 'duplicate project service names must be resolved before reconciliation';
  END IF;

  IF EXISTS (SELECT 1 FROM "environment" GROUP BY "projectId", "name" HAVING count(*) > 1) THEN
    RAISE EXCEPTION 'duplicate project environment names must be resolved before reconciliation';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM "environment"
    WHERE "previewPrNumber" IS NOT NULL
    GROUP BY "projectId", "previewPrNumber"
    HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'duplicate preview pull request environments must be resolved before reconciliation';
  END IF;

  IF EXISTS (SELECT 1 FROM "domain" GROUP BY "hostname" HAVING count(*) > 1) THEN
    RAISE EXCEPTION 'duplicate domain hostnames must be resolved before reconciliation';
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'outboxStatus') THEN
    CREATE TYPE "outboxStatus" AS ENUM (
      'pending',
      'dispatching',
      'delivered',
      'failed',
      'dead_letter'
    );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'platformRole') THEN
    CREATE TYPE "platformRole" AS ENUM ('user', 'operator');
  END IF;
END
$$;

ALTER TABLE "integration_grant"
  ADD COLUMN IF NOT EXISTS "accessTokenEncrypted" text,
  ADD COLUMN IF NOT EXISTS "accessTokenIv" varchar(64),
  ADD COLUMN IF NOT EXISTS "accessTokenAuthTag" varchar(64),
  ADD COLUMN IF NOT EXISTS "refreshTokenEncrypted" text,
  ADD COLUMN IF NOT EXISTS "refreshTokenIv" varchar(64),
  ADD COLUMN IF NOT EXISTS "refreshTokenAuthTag" varchar(64),
  ADD COLUMN IF NOT EXISTS "encryptionKeyVersion" integer;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'integration_grant'
      AND column_name = 'accessToken'
  ) THEN
    ALTER TABLE "integration_grant" ALTER COLUMN "accessToken" DROP NOT NULL;
  END IF;
END
$$;

ALTER TABLE "aiTask"
  ADD COLUMN IF NOT EXISTS "dispatchAttemptCount" integer DEFAULT 0 NOT NULL,
  ADD COLUMN IF NOT EXISTS "lastDispatchedAt" timestamp,
  ADD COLUMN IF NOT EXISTS "leaseToken" uuid,
  ADD COLUMN IF NOT EXISTS "leaseExpiresAt" timestamp,
  ADD COLUMN IF NOT EXISTS "heartbeatAt" timestamp,
  ADD COLUMN IF NOT EXISTS "updatedAt" timestamp DEFAULT now() NOT NULL;

ALTER TABLE "user"
  ADD COLUMN IF NOT EXISTS "platformRole" "platformRole" DEFAULT 'user' NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'teamMember_team_user_unique'
  ) THEN
    ALTER TABLE "teamMember"
      ADD CONSTRAINT "teamMember_team_user_unique" UNIQUE ("teamId", "userId");
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'projectInitStep_project_step_unique'
  ) THEN
    ALTER TABLE "projectInitStep"
      ADD CONSTRAINT "projectInitStep_project_step_unique" UNIQUE ("projectId", "step");
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'service_project_name_unique'
  ) THEN
    ALTER TABLE "service"
      ADD CONSTRAINT "service_project_name_unique" UNIQUE ("projectId", "name");
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'environment_project_name_unique'
  ) THEN
    ALTER TABLE "environment"
      ADD CONSTRAINT "environment_project_name_unique" UNIQUE ("projectId", "name");
  END IF;
END
$$;

CREATE UNIQUE INDEX IF NOT EXISTS "teamIntegrationBinding_active_identity_unique"
  ON "teamIntegrationBinding" ("teamId", "integrationIdentityId")
  WHERE "revokedAt" IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "teamIntegrationBinding_active_default_unique"
  ON "teamIntegrationBinding" ("teamId")
  WHERE "revokedAt" IS NULL AND "isDefault" = true;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_class AS index
    JOIN pg_index ON pg_index.indexrelid = index.oid
    WHERE index.relname = 'project_slug_idx'
      AND index.relnamespace = 'public'::regnamespace
      AND NOT pg_index.indisunique
  ) THEN
    DROP INDEX "project_slug_idx";
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_class AS index
    JOIN pg_index ON pg_index.indexrelid = index.oid
    WHERE index.relname = 'domain_hostname_idx'
      AND index.relnamespace = 'public'::regnamespace
      AND NOT pg_index.indisunique
  ) THEN
    DROP INDEX "domain_hostname_idx";
  END IF;
END
$$;

CREATE UNIQUE INDEX IF NOT EXISTS "project_slug_idx" ON "project" ("slug");
CREATE UNIQUE INDEX IF NOT EXISTS "domain_hostname_idx" ON "domain" ("hostname");
CREATE UNIQUE INDEX IF NOT EXISTS "environment_project_preview_pr_unique"
  ON "environment" ("projectId", "previewPrNumber")
  WHERE "previewPrNumber" IS NOT NULL;

CREATE TABLE IF NOT EXISTS "releaseEvent" (
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

CREATE INDEX IF NOT EXISTS "releaseEvent_release_sequence_idx"
  ON "releaseEvent" ("releaseId", "sequence");
CREATE INDEX IF NOT EXISTS "releaseEvent_project_occurred_at_idx"
  ON "releaseEvent" ("projectId", "occurredAt");
CREATE INDEX IF NOT EXISTS "releaseEvent_correlation_id_idx"
  ON "releaseEvent" ("correlationId");

INSERT INTO "releaseEvent" (
  "releaseId", "projectId", "environmentId", "actorUserId", "eventKey", "type", "data",
  "correlationId", "occurredAt"
)
SELECT id, "projectId", "environmentId", "triggeredByUserId", 'created', 'release.created',
       jsonb_build_object('sourceRef', "sourceRef", 'sourceCommitSha', "sourceCommitSha"),
       id::text, "createdAt"
FROM "release"
ON CONFLICT ("releaseId", "eventKey") DO NOTHING;

INSERT INTO "releaseEvent" (
  "releaseId", "projectId", "environmentId", "eventKey", "type", "data", "correlationId",
  "occurredAt"
)
SELECT id, "projectId", "environmentId", 'status:backfill:' || status::text,
       'release.status.changed', jsonb_build_object('from', 'unknown', 'to', status::text,
       'errorMessage', "errorMessage"), id::text, "updatedAt"
FROM "release"
WHERE status <> 'queued'
ON CONFLICT ("releaseId", "eventKey") DO NOTHING;

CREATE TABLE IF NOT EXISTS "outboxMessage" (
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

ALTER TABLE "outboxMessage"
  ADD COLUMN IF NOT EXISTS "replayedFromId" uuid,
  ADD COLUMN IF NOT EXISTS "createdByUserId" uuid,
  ADD COLUMN IF NOT EXISTS "resolvedAt" timestamp,
  ADD COLUMN IF NOT EXISTS "resolvedByUserId" uuid,
  ADD COLUMN IF NOT EXISTS "resolutionNote" text,
  ADD COLUMN IF NOT EXISTS "replayMessageId" uuid;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'outboxMessage_replayedFromId_fk'
  ) THEN
    ALTER TABLE "outboxMessage"
      ADD CONSTRAINT "outboxMessage_replayedFromId_fk"
      FOREIGN KEY ("replayedFromId") REFERENCES "outboxMessage"("id") ON DELETE set null;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'outboxMessage_createdByUserId_fk'
  ) THEN
    ALTER TABLE "outboxMessage"
      ADD CONSTRAINT "outboxMessage_createdByUserId_fk"
      FOREIGN KEY ("createdByUserId") REFERENCES "user"("id") ON DELETE set null;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'outboxMessage_resolvedByUserId_fk'
  ) THEN
    ALTER TABLE "outboxMessage"
      ADD CONSTRAINT "outboxMessage_resolvedByUserId_fk"
      FOREIGN KEY ("resolvedByUserId") REFERENCES "user"("id") ON DELETE set null;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'outboxMessage_replayMessageId_fk'
  ) THEN
    ALTER TABLE "outboxMessage"
      ADD CONSTRAINT "outboxMessage_replayMessageId_fk"
      FOREIGN KEY ("replayMessageId") REFERENCES "outboxMessage"("id") ON DELETE set null;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'outboxMessage_replay_message_unique'
  ) THEN
    ALTER TABLE "outboxMessage"
      ADD CONSTRAINT "outboxMessage_replay_message_unique" UNIQUE ("replayMessageId");
  END IF;
END
$$;

CREATE INDEX IF NOT EXISTS "outboxMessage_dispatch_idx"
  ON "outboxMessage" ("status", "availableAt");
CREATE INDEX IF NOT EXISTS "outboxMessage_aggregate_idx"
  ON "outboxMessage" ("aggregateType", "aggregateId");
CREATE INDEX IF NOT EXISTS "outboxMessage_replayed_from_idx"
  ON "outboxMessage" ("replayedFromId");
CREATE INDEX IF NOT EXISTS "outboxMessage_unresolved_dead_letter_idx"
  ON "outboxMessage" ("status", "resolvedAt", "createdAt");

CREATE TABLE IF NOT EXISTS "aiTokenBudget" (
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

CREATE TABLE IF NOT EXISTS "aiTokenReservation" (
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

CREATE INDEX IF NOT EXISTS "aiTokenReservation_team_period_idx"
  ON "aiTokenReservation" ("teamId", "periodStart");
CREATE INDEX IF NOT EXISTS "aiTask_recovery_idx"
  ON "aiTask" ("status", "leaseExpiresAt", "createdAt");
