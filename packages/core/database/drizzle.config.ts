import { defineConfig } from 'drizzle-kit'

// 优先使用 DATABASE_URL；否则按 POSTGRES_* 变量拼接（缺失即报错）
const envUrl = process.env.DATABASE_URL
function requireEnv(name: string): string {
  const v = process.env[name]
  if (!v) {
    throw new Error(`[drizzle] Missing env ${name}. Provide ${name} or DATABASE_URL.`)
  }
  return v
}

const composedUrl = `postgresql://${requireEnv('POSTGRES_USER')}:${encodeURIComponent(
  requireEnv('POSTGRES_PASSWORD'),
)}@${requireEnv('POSTGRES_HOST')}:${requireEnv('POSTGRES_PORT')}/${requireEnv('POSTGRES_DB')}`
const url = envUrl ?? composedUrl

export default defineConfig({
  schema: 'packages/core/database/src/schemas/index.ts',
  out: 'packages/core/database/drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url,
  },
})
