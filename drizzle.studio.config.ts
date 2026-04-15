import { defineConfig } from 'drizzle-kit';
import { getDrizzleStudioDatabaseUrlFromEnv } from './src/lib/db/drizzle-config';

export default defineConfig({
  dialect: 'postgresql',
  schema: './src/lib/db/schema.ts',
  out: './drizzle',
  dbCredentials: {
    url: getDrizzleStudioDatabaseUrlFromEnv(),
  },
});
