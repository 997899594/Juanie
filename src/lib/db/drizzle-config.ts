import { getNormalizedDatabaseUrlFromEnv } from './connection-url';

export const DRIZZLE_SCHEMA_TOOLING_URL =
  'postgresql://postgres:postgres@127.0.0.1:5432/postgres?sslmode=disable';

export function getDrizzleSchemaToolingUrl(): string {
  return DRIZZLE_SCHEMA_TOOLING_URL;
}

export function getDrizzleStudioDatabaseUrlFromEnv(): string {
  return getNormalizedDatabaseUrlFromEnv();
}
