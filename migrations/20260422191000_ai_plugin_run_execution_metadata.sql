ALTER TABLE "aiPluginRun"
ADD COLUMN "actorUserId" uuid REFERENCES "user"("id") ON DELETE SET NULL;

ALTER TABLE "aiPluginRun"
ADD COLUMN "outputSchema" character varying(100);

ALTER TABLE "aiPluginRun"
ADD COLUMN "toolCalls" jsonb NOT NULL DEFAULT '[]'::jsonb;
