ALTER TABLE "integration_grant"
  DROP COLUMN "accessToken",
  DROP COLUMN "refreshToken";

DROP TABLE "gitProvider";

ALTER TABLE "account"
  ADD CONSTRAINT "account_provider_credentials_absent"
  CHECK (access_token IS NULL AND refresh_token IS NULL AND id_token IS NULL);
