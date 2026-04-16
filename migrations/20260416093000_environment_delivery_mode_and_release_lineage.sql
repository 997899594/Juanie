-- Create enum type "environmentDeliveryMode"
CREATE TYPE "environmentDeliveryMode" AS ENUM ('direct', 'promote_only');

-- Modify "environment" table
ALTER TABLE "environment"
ADD COLUMN "deliveryMode" "environmentDeliveryMode" NOT NULL DEFAULT 'direct';

UPDATE "environment"
SET "deliveryMode" = CASE
  WHEN "kind" = 'production'::"environmentKind" OR COALESCE("isProduction", false) = true
    THEN 'promote_only'::"environmentDeliveryMode"
  ELSE 'direct'::"environmentDeliveryMode"
END;

-- Modify "release" table
ALTER TABLE "release"
ADD COLUMN "sourceReleaseId" uuid NULL,
ADD CONSTRAINT "release_sourceReleaseId_release_id_fk"
FOREIGN KEY ("sourceReleaseId") REFERENCES "release" ("id") ON UPDATE NO ACTION ON DELETE SET NULL;

-- Create index "release_sourceReleaseId_idx" to table: "release"
CREATE INDEX "release_sourceReleaseId_idx" ON "release" ("sourceReleaseId");
