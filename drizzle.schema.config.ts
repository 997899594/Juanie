import { defineConfig } from 'drizzle-kit';
import { getDrizzleSchemaToolingUrl } from './src/lib/db/drizzle-config';

export default defineConfig({
  dialect: 'postgresql',
  schema: './src/lib/db/schema.ts',
  out: './drizzle',
  dbCredentials: {
    url: getDrizzleSchemaToolingUrl(),
  },
});
