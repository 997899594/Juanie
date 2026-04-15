-- Modify "environment" table
ALTER TABLE "environment" ADD COLUMN "previewBuildStatus" "deploymentStatus" NULL, ADD COLUMN "previewBuildSourceRef" character varying(255) NULL, ADD COLUMN "previewBuildSourceCommitSha" character varying(100) NULL, ADD COLUMN "previewBuildStartedAt" timestamp NULL;
