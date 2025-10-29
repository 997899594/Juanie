import { defineConfig } from 'drizzle-kit'

export default defineConfig({
  schema: '../../packages/core/database/src/schemas/index.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url:
      process.env.DATABASE_URL || 'postgresql://devops_user:devops_password@localhost:5432/devops',
  },
})
