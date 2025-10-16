import { defineConfig } from 'drizzle-kit'
import { getConfig } from './src/core/config'

const config = getConfig()
console.log('[drizzle.config] DATABASE_URL:', config.database.url)

export default defineConfig({
  schema: './src/drizzle/schemas/index.ts',
  out: './src/drizzle/migrations',
  dialect: 'postgresql',
  dbCredentials: {
    url: config.database.url,
  },
  verbose: true,
  strict: true,
})
