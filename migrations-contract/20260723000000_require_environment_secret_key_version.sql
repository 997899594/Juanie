ALTER TABLE "environmentVariable"
  ADD CONSTRAINT "environmentVariable_secret_envelope_versioned"
  CHECK (
    "isSecret" IS NOT TRUE
    OR (
      "value" IS NULL
      AND "encryptedValue" IS NOT NULL
      AND "iv" IS NOT NULL
      AND "authTag" IS NOT NULL
      AND "encryptionKeyVersion" IS NOT NULL
    )
  ) NOT VALID;

ALTER TABLE "environmentVariable"
  VALIDATE CONSTRAINT "environmentVariable_secret_envelope_versioned";

ALTER TABLE "environmentVariable"
  DROP CONSTRAINT "environmentVariable_secret_envelope_required";

ALTER TABLE "environmentVariable"
  RENAME CONSTRAINT "environmentVariable_secret_envelope_versioned"
  TO "environmentVariable_secret_envelope_required";
