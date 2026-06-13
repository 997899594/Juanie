CREATE TYPE "public"."buildRunStatus" AS ENUM (
  'pending',
  'running',
  'succeeded',
  'failed',
  'finalizing',
  'finalized'
);

CREATE TYPE "public"."buildUnitStatus" AS ENUM (
  'pending',
  'running',
  'succeeded',
  'failed'
);

CREATE TYPE "public"."buildArtifactKind" AS ENUM (
  'image',
  'package',
  'static',
  'function'
);

CREATE TABLE "public"."buildRun" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "projectId" uuid NOT NULL,
  "repositoryId" uuid,
  "releaseId" uuid,
  "sourceRepository" varchar(255) NOT NULL,
  "sourceRef" varchar(255) NOT NULL,
  "sourceCommitSha" varchar(100) NOT NULL,
  "provider" varchar(40) DEFAULT 'github' NOT NULL,
  "externalRunId" varchar(255),
  "status" "public"."buildRunStatus" DEFAULT 'pending' NOT NULL,
  "plan" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "errorMessage" text,
  "createdAt" timestamp DEFAULT now() NOT NULL,
  "updatedAt" timestamp DEFAULT now() NOT NULL,
  "startedAt" timestamp,
  "finishedAt" timestamp
);

CREATE TABLE "public"."buildUnit" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "buildRunId" uuid NOT NULL,
  "serviceId" uuid,
  "unitKey" varchar(120) NOT NULL,
  "serviceName" varchar(100) NOT NULL,
  "status" "public"."buildUnitStatus" DEFAULT 'pending' NOT NULL,
  "image" varchar(1000),
  "imageDigest" varchar(255),
  "metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "errorMessage" text,
  "createdAt" timestamp DEFAULT now() NOT NULL,
  "updatedAt" timestamp DEFAULT now() NOT NULL,
  "startedAt" timestamp,
  "finishedAt" timestamp
);

CREATE TABLE "public"."buildArtifact" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "buildRunId" uuid NOT NULL,
  "buildUnitId" uuid NOT NULL,
  "serviceId" uuid,
  "kind" "public"."buildArtifactKind" DEFAULT 'image' NOT NULL,
  "name" varchar(120) NOT NULL,
  "uri" varchar(1000) NOT NULL,
  "digest" varchar(255),
  "metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "createdAt" timestamp DEFAULT now() NOT NULL
);

ALTER TABLE "public"."buildRun"
  ADD CONSTRAINT "buildRun_projectId_project_id_fk"
  FOREIGN KEY ("projectId") REFERENCES "public"."project"("id")
  ON DELETE cascade ON UPDATE no action;

ALTER TABLE "public"."buildRun"
  ADD CONSTRAINT "buildRun_repositoryId_repository_id_fk"
  FOREIGN KEY ("repositoryId") REFERENCES "public"."repository"("id")
  ON DELETE set null ON UPDATE no action;

ALTER TABLE "public"."buildRun"
  ADD CONSTRAINT "buildRun_releaseId_release_id_fk"
  FOREIGN KEY ("releaseId") REFERENCES "public"."release"("id")
  ON DELETE set null ON UPDATE no action;

ALTER TABLE "public"."buildUnit"
  ADD CONSTRAINT "buildUnit_buildRunId_buildRun_id_fk"
  FOREIGN KEY ("buildRunId") REFERENCES "public"."buildRun"("id")
  ON DELETE cascade ON UPDATE no action;

ALTER TABLE "public"."buildUnit"
  ADD CONSTRAINT "buildUnit_serviceId_service_id_fk"
  FOREIGN KEY ("serviceId") REFERENCES "public"."service"("id")
  ON DELETE set null ON UPDATE no action;

ALTER TABLE "public"."buildArtifact"
  ADD CONSTRAINT "buildArtifact_buildRunId_buildRun_id_fk"
  FOREIGN KEY ("buildRunId") REFERENCES "public"."buildRun"("id")
  ON DELETE cascade ON UPDATE no action;

ALTER TABLE "public"."buildArtifact"
  ADD CONSTRAINT "buildArtifact_buildUnitId_buildUnit_id_fk"
  FOREIGN KEY ("buildUnitId") REFERENCES "public"."buildUnit"("id")
  ON DELETE cascade ON UPDATE no action;

ALTER TABLE "public"."buildArtifact"
  ADD CONSTRAINT "buildArtifact_serviceId_service_id_fk"
  FOREIGN KEY ("serviceId") REFERENCES "public"."service"("id")
  ON DELETE set null ON UPDATE no action;

CREATE INDEX "buildRun_projectId_idx" ON "public"."buildRun" ("projectId");
CREATE INDEX "buildRun_repositoryId_idx" ON "public"."buildRun" ("repositoryId");
CREATE INDEX "buildRun_releaseId_idx" ON "public"."buildRun" ("releaseId");
CREATE INDEX "buildRun_source_idx" ON "public"."buildRun" (
  "sourceRepository",
  "sourceRef",
  "sourceCommitSha"
);
ALTER TABLE "public"."buildRun"
  ADD CONSTRAINT "buildRun_repository_provider_external_unique"
  UNIQUE ("repositoryId", "provider", "externalRunId");
CREATE INDEX "buildRun_status_idx" ON "public"."buildRun" ("status");

CREATE INDEX "buildUnit_buildRunId_idx" ON "public"."buildUnit" ("buildRunId");
CREATE INDEX "buildUnit_serviceId_idx" ON "public"."buildUnit" ("serviceId");
CREATE INDEX "buildUnit_status_idx" ON "public"."buildUnit" ("status");
ALTER TABLE "public"."buildUnit"
  ADD CONSTRAINT "buildUnit_buildRun_unit_unique" UNIQUE ("buildRunId", "unitKey");

CREATE INDEX "buildArtifact_buildRunId_idx" ON "public"."buildArtifact" ("buildRunId");
CREATE INDEX "buildArtifact_buildUnitId_idx" ON "public"."buildArtifact" ("buildUnitId");
CREATE INDEX "buildArtifact_serviceId_idx" ON "public"."buildArtifact" ("serviceId");
ALTER TABLE "public"."buildArtifact"
  ADD CONSTRAINT "buildArtifact_buildUnit_kind_name_unique"
  UNIQUE ("buildUnitId", "kind", "name");
