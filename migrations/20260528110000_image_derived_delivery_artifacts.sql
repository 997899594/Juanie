ALTER TABLE "releaseArtifact" ADD COLUMN "sourceServiceId" uuid;
ALTER TABLE "releaseArtifact" ADD COLUMN "sourceImageUri" varchar(1000);
ALTER TABLE "releaseArtifact" ADD COLUMN "sourceImageDigest" varchar(255);
ALTER TABLE "releaseArtifact" ADD COLUMN "sourceImagePlatform" varchar(80);

ALTER TABLE "releaseArtifact"
  ADD CONSTRAINT "releaseArtifact_sourceServiceId_service_id_fk"
  FOREIGN KEY ("sourceServiceId") REFERENCES "public"."service"("id")
  ON DELETE set null ON UPDATE no action;

CREATE INDEX "releaseArtifact_sourceServiceId_idx" ON "releaseArtifact" ("sourceServiceId");

ALTER TABLE "releaseArtifact"
  ADD CONSTRAINT "releaseArtifact_release_delivery_unique"
  UNIQUE ("releaseId", "kind", "name", "variant", "platform");
