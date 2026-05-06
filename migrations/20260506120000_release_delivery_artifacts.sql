ALTER TABLE "releaseArtifact" ALTER COLUMN "serviceId" DROP NOT NULL;
ALTER TABLE "releaseArtifact" ALTER COLUMN "imageUrl" DROP NOT NULL;

ALTER TABLE "releaseArtifact" ADD COLUMN "kind" varchar(20) NOT NULL DEFAULT 'image';
ALTER TABLE "releaseArtifact" ADD COLUMN "name" varchar(100);
ALTER TABLE "releaseArtifact" ADD COLUMN "variant" varchar(100);
ALTER TABLE "releaseArtifact" ADD COLUMN "platform" varchar(80);
ALTER TABLE "releaseArtifact" ADD COLUMN "format" varchar(40);
ALTER TABLE "releaseArtifact" ADD COLUMN "uri" varchar(1000);
ALTER TABLE "releaseArtifact" ADD COLUMN "checksum" varchar(255);
ALTER TABLE "releaseArtifact" ADD COLUMN "sizeBytes" bigint;
ALTER TABLE "releaseArtifact" ADD COLUMN "sbomUri" varchar(1000);
ALTER TABLE "releaseArtifact" ADD COLUMN "provenanceUri" varchar(1000);
ALTER TABLE "releaseArtifact" ADD COLUMN "status" varchar(20) NOT NULL DEFAULT 'succeeded';

UPDATE "releaseArtifact"
SET "uri" = "imageUrl"
WHERE "uri" IS NULL AND "imageUrl" IS NOT NULL;

CREATE INDEX "releaseArtifact_kind_idx" ON "releaseArtifact" ("kind");
CREATE INDEX "releaseArtifact_status_idx" ON "releaseArtifact" ("status");
