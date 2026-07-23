-- Modify "environmentVariable" table
ALTER TABLE "public"."environmentVariable" ADD COLUMN "encryptionKeyVersion" integer NULL;
