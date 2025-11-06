import { defineConfig } from 'drizzle-kit'
import path from 'path'
import { fileURLToPath } from 'url'

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
  // 以配置文件所在目录为基准，避免从根目录运行时路径失效
  schema: path.join(path.dirname(fileURLToPath(import.meta.url)), 'src', 'schemas', 'index.ts'),
  out: path.join(path.dirname(fileURLToPath(import.meta.url)), 'drizzle'),
  dialect: 'postgresql',
  dbCredentials: {
    url,
  },
})
