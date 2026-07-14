CREATE TYPE "platformRole" AS ENUM ('user', 'operator');

ALTER TABLE "user"
  ADD COLUMN "platformRole" "platformRole" DEFAULT 'user' NOT NULL;

ALTER TABLE "outboxMessage"
  ADD COLUMN "replayedFromId" uuid,
  ADD COLUMN "createdByUserId" uuid,
  ADD COLUMN "resolvedAt" timestamp,
  ADD COLUMN "resolvedByUserId" uuid,
  ADD COLUMN "resolutionNote" text,
  ADD COLUMN "replayMessageId" uuid,
  ADD CONSTRAINT "outboxMessage_replayedFromId_fk"
    FOREIGN KEY ("replayedFromId") REFERENCES "outboxMessage"("id") ON DELETE set null,
  ADD CONSTRAINT "outboxMessage_createdByUserId_fk"
    FOREIGN KEY ("createdByUserId") REFERENCES "user"("id") ON DELETE set null,
  ADD CONSTRAINT "outboxMessage_resolvedByUserId_fk"
    FOREIGN KEY ("resolvedByUserId") REFERENCES "user"("id") ON DELETE set null,
  ADD CONSTRAINT "outboxMessage_replayMessageId_fk"
    FOREIGN KEY ("replayMessageId") REFERENCES "outboxMessage"("id") ON DELETE set null,
  ADD CONSTRAINT "outboxMessage_replay_message_unique" UNIQUE ("replayMessageId");

CREATE INDEX "outboxMessage_replayed_from_idx" ON "outboxMessage" ("replayedFromId");
CREATE INDEX "outboxMessage_unresolved_dead_letter_idx"
  ON "outboxMessage" ("status", "resolvedAt", "createdAt");
