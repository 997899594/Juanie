import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: './src/database/schemas/index.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL || 'postgresql://localhost:5432/devops',
  },
});
