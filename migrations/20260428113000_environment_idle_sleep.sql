ALTER TABLE "environment" ADD COLUMN "autoSleepEnabled" boolean NOT NULL DEFAULT true;
ALTER TABLE "environment" ADD COLUMN "idleSleepMinutes" integer;
ALTER TABLE "environment" ADD COLUMN "lastRuntimeActivityAt" timestamp NOT NULL DEFAULT now();
ALTER TABLE "environment" ADD COLUMN "lastRuntimeSleptAt" timestamp;

UPDATE "environment"
SET "autoSleepEnabled" = false
WHERE "kind" = 'production' OR "isProduction" = true;

CREATE INDEX "environment_idle_sleep_idx"
  ON "environment" ("autoSleepEnabled", "kind", "lastRuntimeActivityAt");
