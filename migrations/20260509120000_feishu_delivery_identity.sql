ALTER TYPE "teamRole" ADD VALUE IF NOT EXISTS 'delivery';

CREATE TABLE "artifactDownloadEvent" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "teamId" uuid NOT NULL,
  "projectId" uuid NOT NULL,
  "releaseId" uuid NOT NULL,
  "artifactId" uuid NOT NULL,
  "userId" uuid,
  "ipAddress" varchar(50),
  "userAgent" text,
  "createdAt" timestamp DEFAULT now() NOT NULL
);

ALTER TABLE "artifactDownloadEvent"
  ADD CONSTRAINT "artifactDownloadEvent_teamId_team_id_fk"
  FOREIGN KEY ("teamId") REFERENCES "public"."team"("id")
  ON DELETE cascade ON UPDATE no action;

ALTER TABLE "artifactDownloadEvent"
  ADD CONSTRAINT "artifactDownloadEvent_projectId_project_id_fk"
  FOREIGN KEY ("projectId") REFERENCES "public"."project"("id")
  ON DELETE cascade ON UPDATE no action;

ALTER TABLE "artifactDownloadEvent"
  ADD CONSTRAINT "artifactDownloadEvent_releaseId_release_id_fk"
  FOREIGN KEY ("releaseId") REFERENCES "public"."release"("id")
  ON DELETE cascade ON UPDATE no action;

ALTER TABLE "artifactDownloadEvent"
  ADD CONSTRAINT "artifactDownloadEvent_artifactId_releaseArtifact_id_fk"
  FOREIGN KEY ("artifactId") REFERENCES "public"."releaseArtifact"("id")
  ON DELETE cascade ON UPDATE no action;

ALTER TABLE "artifactDownloadEvent"
  ADD CONSTRAINT "artifactDownloadEvent_userId_user_id_fk"
  FOREIGN KEY ("userId") REFERENCES "public"."user"("id")
  ON DELETE set null ON UPDATE no action;

CREATE INDEX "artifactDownloadEvent_teamId_idx" ON "artifactDownloadEvent" USING btree ("teamId");
CREATE INDEX "artifactDownloadEvent_projectId_idx" ON "artifactDownloadEvent" USING btree ("projectId");
CREATE INDEX "artifactDownloadEvent_releaseId_idx" ON "artifactDownloadEvent" USING btree ("releaseId");
CREATE INDEX "artifactDownloadEvent_artifactId_idx" ON "artifactDownloadEvent" USING btree ("artifactId");
CREATE INDEX "artifactDownloadEvent_userId_idx" ON "artifactDownloadEvent" USING btree ("userId");
CREATE INDEX "artifactDownloadEvent_createdAt_idx" ON "artifactDownloadEvent" USING btree ("createdAt");
