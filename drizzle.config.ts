import { defineConfig } from 'drizzle-kit';
import { getNormalizedDatabaseUrlFromEnv } from './src/lib/db/connection-url';

export default defineConfig({
  dialect: 'postgresql',
  schema: './src/lib/db/schema.ts',
  out: './drizzle',
  dbCredentials: {
    url: getNormalizedDatabaseUrlFromEnv(),
  },
});
