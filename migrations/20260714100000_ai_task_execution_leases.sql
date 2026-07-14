ALTER TABLE "aiTask"
  ADD COLUMN "dispatchAttemptCount" integer DEFAULT 0 NOT NULL,
  ADD COLUMN "lastDispatchedAt" timestamp,
  ADD COLUMN "leaseToken" uuid,
  ADD COLUMN "leaseExpiresAt" timestamp,
  ADD COLUMN "heartbeatAt" timestamp,
  ADD COLUMN "updatedAt" timestamp DEFAULT now() NOT NULL;

CREATE INDEX "aiTask_recovery_idx"
  ON "aiTask" ("status", "leaseExpiresAt", "createdAt");
