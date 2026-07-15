ALTER TABLE "release"
  ADD COLUMN "externalRunId" varchar(255),
  ADD COLUMN "executionKey" varchar(255),
  ADD COLUMN "executionGeneration" integer DEFAULT 0 NOT NULL;

UPDATE "release" AS release
SET "externalRunId" = build."externalRunId"
FROM "buildRun" AS build
WHERE build."releaseId" = release.id
  AND build."externalRunId" IS NOT NULL;

UPDATE "release"
SET "executionKey" = 'environment:' || "environmentId"::text
WHERE "executionKey" IS NULL;

ALTER TABLE "release"
  ALTER COLUMN "executionKey" SET NOT NULL;

CREATE TABLE "executionOwnership" (
  "scopeKey" varchar(255) PRIMARY KEY NOT NULL,
  "scopeType" varchar(40) NOT NULL,
  "ownerType" varchar(40) NOT NULL,
  "ownerId" uuid NOT NULL,
  "generation" integer NOT NULL,
  "acquiredAt" timestamp DEFAULT now() NOT NULL,
  "updatedAt" timestamp DEFAULT now() NOT NULL
);

CREATE INDEX "executionOwnership_owner_idx"
  ON "executionOwnership" ("ownerType", "ownerId");

WITH latest_release AS (
  SELECT DISTINCT ON ("environmentId") id, "environmentId", "executionKey"
  FROM "release"
  ORDER BY "environmentId", "createdAt" DESC, id DESC
), inserted AS (
  INSERT INTO "executionOwnership" (
    "scopeKey", "scopeType", "ownerType", "ownerId", "generation"
  )
  SELECT "executionKey", 'environment', 'release', id, 1
  FROM latest_release
  ON CONFLICT ("scopeKey") DO NOTHING
  RETURNING "ownerId"
)
UPDATE "release"
SET "executionGeneration" = 1
WHERE id IN (SELECT "ownerId" FROM inserted);

ALTER TABLE "migrationRun"
  ADD COLUMN "executionGeneration" integer;

UPDATE "migrationRun"
SET "lockKey" = 'environment:' || "environmentId"::text || ':database:' || "databaseId"::text;

UPDATE "outboxMessage" AS message
SET payload = jsonb_set(
  message.payload,
  '{executionKey}',
  to_jsonb('environment:' || release."environmentId"::text),
  true
)
FROM "release" AS release
WHERE message.topic IN ('release.requested', 'release.rollout.requested')
  AND message."aggregateId" = release.id::text
  AND NOT (message.payload ? 'executionKey');

UPDATE "outboxMessage" AS message
SET payload = jsonb_set(message.payload, '{executionKey}', to_jsonb(run."lockKey"), true)
FROM "migrationRun" AS run
WHERE message.topic = 'migration.requested'
  AND message."aggregateId" = run.id::text
  AND NOT (message.payload ? 'executionKey');

ALTER TABLE "environmentVariable"
  ADD CONSTRAINT "environmentVariable_secret_envelope_required"
  CHECK (
    "isSecret" IS NOT TRUE
    OR (
      "value" IS NULL
      AND "encryptedValue" IS NOT NULL
      AND "iv" IS NOT NULL
      AND "authTag" IS NOT NULL
    )
  ) NOT VALID;
