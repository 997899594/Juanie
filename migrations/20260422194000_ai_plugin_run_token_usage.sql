ALTER TABLE "aiPluginRun"
ADD COLUMN "inputTokens" integer;

ALTER TABLE "aiPluginRun"
ADD COLUMN "outputTokens" integer;

ALTER TABLE "aiPluginRun"
ADD COLUMN "totalTokens" integer;
