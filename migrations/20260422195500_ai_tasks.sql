CREATE TYPE "public"."aiTaskKind" AS ENUM('environment_deep_analysis', 'release_deep_analysis');

CREATE TYPE "public"."aiTaskStatus" AS ENUM('queued', 'running', 'succeeded', 'failed');

CREATE TABLE "aiTask" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "kind" "aiTaskKind" NOT NULL,
  "status" "aiTaskStatus" DEFAULT 'queued' NOT NULL,
  "title" varchar(255) NOT NULL,
  "actorUserId" uuid,
  "teamId" uuid NOT NULL,
  "projectId" uuid,
  "environmentId" uuid,
  "releaseId" uuid,
  "inputSummary" text NOT NULL,
  "resultSummary" text,
  "provider" varchar(100),
  "model" varchar(255),
  "inputTokens" integer,
  "outputTokens" integer,
  "totalTokens" integer,
  "errorMessage" text,
  "startedAt" timestamp,
  "completedAt" timestamp,
  "createdAt" timestamp DEFAULT now() NOT NULL
);

ALTER TABLE "aiTask"
  ADD CONSTRAINT "aiTask_actorUserId_user_id_fk"
  FOREIGN KEY ("actorUserId") REFERENCES "public"."user"("id")
  ON DELETE set null ON UPDATE no action;

ALTER TABLE "aiTask"
  ADD CONSTRAINT "aiTask_teamId_team_id_fk"
  FOREIGN KEY ("teamId") REFERENCES "public"."team"("id")
  ON DELETE cascade ON UPDATE no action;

ALTER TABLE "aiTask"
  ADD CONSTRAINT "aiTask_projectId_project_id_fk"
  FOREIGN KEY ("projectId") REFERENCES "public"."project"("id")
  ON DELETE set null ON UPDATE no action;

ALTER TABLE "aiTask"
  ADD CONSTRAINT "aiTask_environmentId_environment_id_fk"
  FOREIGN KEY ("environmentId") REFERENCES "public"."environment"("id")
  ON DELETE set null ON UPDATE no action;

ALTER TABLE "aiTask"
  ADD CONSTRAINT "aiTask_releaseId_release_id_fk"
  FOREIGN KEY ("releaseId") REFERENCES "public"."release"("id")
  ON DELETE set null ON UPDATE no action;

CREATE INDEX "aiTask_teamId_idx" ON "aiTask" USING btree ("teamId");
CREATE INDEX "aiTask_projectId_idx" ON "aiTask" USING btree ("projectId");
CREATE INDEX "aiTask_environmentId_idx" ON "aiTask" USING btree ("environmentId");
CREATE INDEX "aiTask_releaseId_idx" ON "aiTask" USING btree ("releaseId");
CREATE INDEX "aiTask_createdAt_idx" ON "aiTask" USING btree ("createdAt");
CREATE INDEX "aiTask_kind_status_idx" ON "aiTask" USING btree ("kind", "status");
